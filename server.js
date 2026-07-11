import express from "express";
import multer from "multer";
import archiver from "archiver";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateSiteSpec, regenerateSection, reviseSpec, REGENERATABLE_SECTIONS } from "./lib/generator.js";
import { THEMES } from "./lib/renderer.js";
import { writeSiteFiles, readMeta, exportFileList, readIndex, updateIndex } from "./lib/site.js";
import { extractText } from "./lib/importers.js";
import { publishSite } from "./lib/publish.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = process.env.VERCEL
  ? path.join("/tmp", "generated")
  : path.join(__dirname, "generated");
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 }
});

/** Simple in-memory per-IP rate limiter. */
function rateLimit(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.ip) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ error: "Too many requests — please wait a minute and try again." });
    }
    recent.push(now);
    hits.set(req.ip, recent);
    next();
  };
}
const generateLimiter = rateLimit(10, 60_000);

const IMAGE_EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg", "image/webp": "webp" };

/** Parse and validate a custom-theme hue; returns a number or null. */
function parseHue(value) {
  const hue = Number(value);
  return Number.isFinite(hue) ? ((Math.round(hue) % 360) + 360) % 360 : null;
}

/** Generate a website from a description, optional documents, a logo, and photos. */
app.post("/api/generate", generateLimiter, upload.fields([
  { name: "documents", maxCount: 5 },
  { name: "logo", maxCount: 1 },
  { name: "photos", maxCount: 4 }
]), async (req, res) => {
  try {
    const description = (req.body.description || "").trim();
    const theme = req.body.theme || "warm";
    const documents = req.files?.documents ?? [];
    const logoFile = req.files?.logo?.[0];
    const photoFiles = req.files?.photos ?? [];
    if (!description && !documents.length) {
      return res.status(400).json({ error: "Provide a business description or at least one document." });
    }
    if (theme !== "custom" && !THEMES[theme]) {
      return res.status(400).json({ error: `Unknown theme: ${theme}` });
    }
    if (logoFile && !IMAGE_EXTENSIONS[logoFile.mimetype]) {
      return res.status(400).json({ error: "Logo must be a PNG, JPEG, SVG, or WebP image." });
    }
    for (const photo of photoFiles) {
      if (!IMAGE_EXTENSIONS[photo.mimetype]) {
        return res.status(400).json({ error: `${photo.originalname}: photos must be PNG, JPEG, SVG, or WebP images.` });
      }
    }

    const VISION_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
    const docTexts = [];
    const images = [];
    for (const file of documents) {
      if (VISION_TYPES.has(file.mimetype)) {
        images.push({ mediaType: file.mimetype, data: file.buffer.toString("base64") });
        continue;
      }
      try {
        const text = await extractText(file.originalname, file.buffer);
        docTexts.push(`--- ${file.originalname} ---\n${text}`);
      } catch (err) {
        return res.status(400).json({ error: `${file.originalname}: ${err.message}` });
      }
    }
    const { spec, mode } = await generateSiteSpec(description, docTexts.join("\n\n"), images);

    const id = randomUUID().slice(0, 8);
    const dir = path.join(GENERATED_DIR, id);
    const meta = { theme, multiPage: req.body.multiPage === "true" || req.body.multiPage === true };
    if (theme === "custom") {
      const hue = parseHue(req.body.hue);
      if (hue === null) return res.status(400).json({ error: "Custom theme requires a numeric hue (0-359)." });
      meta.hue = hue;
    }
    if (logoFile || photoFiles.length) await fs.mkdir(dir, { recursive: true });
    if (logoFile) {
      meta.logo = `logo.${IMAGE_EXTENSIONS[logoFile.mimetype]}`;
      await fs.writeFile(path.join(dir, meta.logo), logoFile.buffer);
    }
    if (photoFiles.length) {
      meta.photos = [];
      for (const [i, photo] of photoFiles.entries()) {
        const name = `photo-${i + 1}.${IMAGE_EXTENSIONS[photo.mimetype]}`;
        await fs.writeFile(path.join(dir, name), photo.buffer);
        meta.photos.push(name);
      }
    }
    await writeSiteFiles(dir, spec, meta);
    await updateIndex(GENERATED_DIR, id, {
      businessName: spec.businessName,
      tagline: spec.tagline,
      createdAt: new Date().toISOString()
    });
    res.json({ id, previewUrl: `/sites/${id}/`, spec, mode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Generation failed" });
  }
});

/** Re-render an existing site's spec (possibly edited) with a chosen theme. */
app.post("/api/sites/:id/render", async (req, res) => {
  try {
    const dir = siteDir(req.params.id);
    const { spec: bodySpec, theme, hue, multiPage, formspreeId } = req.body;
    const spec = bodySpec ?? JSON.parse(await fs.readFile(path.join(dir, "spec.json"), "utf-8"));
    const meta = await readMeta(dir);
    if (theme) {
      if (theme !== "custom" && !THEMES[theme]) return res.status(400).json({ error: `Unknown theme: ${theme}` });
      meta.theme = theme;
    }
    if (meta.theme === "custom") {
      const parsed = parseHue(hue ?? meta.hue);
      if (parsed === null) return res.status(400).json({ error: "Custom theme requires a numeric hue (0-359)." });
      meta.hue = parsed;
    }
    if (multiPage !== undefined) meta.multiPage = Boolean(multiPage);
    if (formspreeId !== undefined) {
      if (formspreeId && !/^[a-zA-Z0-9]{1,32}$/.test(formspreeId)) {
        return res.status(400).json({ error: "Formspree ID must be alphanumeric." });
      }
      meta.formspreeId = formspreeId || undefined;
    }

    await writeSiteFiles(dir, spec, meta);
    await refreshIndexEntry(req.params.id, spec);
    res.json({ id: req.params.id, previewUrl: `/sites/${req.params.id}/` });
  } catch (err) {
    res.status(err.code === "ENOENT" ? 404 : 500).json({ error: err.message });
  }
});

/** Regenerate one section of a site's content with AI. */
app.post("/api/sites/:id/regenerate", async (req, res) => {
  try {
    const dir = siteDir(req.params.id);
    const { section, instructions = "" } = req.body;
    if (!REGENERATABLE_SECTIONS.includes(section)) {
      return res.status(400).json({ error: `section must be one of: ${REGENERATABLE_SECTIONS.join(", ")}` });
    }
    const spec = JSON.parse(await fs.readFile(path.join(dir, "spec.json"), "utf-8"));
    const meta = await readMeta(dir);

    spec[section] = await regenerateSection(spec, section, instructions);
    await writeSiteFiles(dir, spec, meta);
    await refreshIndexEntry(req.params.id, spec);
    res.json({ id: req.params.id, spec, previewUrl: `/sites/${req.params.id}/` });
  } catch (err) {
    if (err.code === "ENOENT") return res.status(404).json({ error: "Site not found" });
    console.error(err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/** Revise a whole site from a conversational instruction. */
app.post("/api/sites/:id/revise", async (req, res) => {
  try {
    const dir = siteDir(req.params.id);
    const message = (req.body.message || "").trim();
    if (!message) return res.status(400).json({ error: "Provide a revision message." });
    const spec = JSON.parse(await fs.readFile(path.join(dir, "spec.json"), "utf-8"));
    const meta = await readMeta(dir);

    const revised = await reviseSpec(spec, message);
    await writeSiteFiles(dir, revised, meta);
    await refreshIndexEntry(req.params.id, revised);
    res.json({ id: req.params.id, spec: revised, previewUrl: `/sites/${req.params.id}/` });
  } catch (err) {
    if (err.code === "ENOENT") return res.status(404).json({ error: "Site not found" });
    console.error(err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/** Publish a site to GitHub Pages via the gh CLI. */
app.post("/api/sites/:id/publish", async (req, res) => {
  try {
    const dir = siteDir(req.params.id);
    const repo = String(req.body.repo || "").trim();
    const result = await publishSite(dir, repo);
    res.json({ id: req.params.id, ...result });
  } catch (err) {
    if (err.code === "ENOENT") return res.status(404).json({ error: "Site not found" });
    console.error(err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/** List generated sites. */
app.get("/api/sites", async (_req, res) => {
  const index = await readIndex(GENERATED_DIR);
  res.json(index.map((e) => ({ ...e, previewUrl: `/sites/${e.id}/` })));
});

/** Fetch a site's editable spec. */
app.get("/api/sites/:id", async (req, res) => {
  try {
    const dir = siteDir(req.params.id);
    const spec = JSON.parse(await fs.readFile(path.join(dir, "spec.json"), "utf-8"));
    const meta = await readMeta(dir);
    res.json({
      id: req.params.id,
      spec,
      theme: meta.theme,
      hue: meta.hue ?? null,
      logo: meta.logo ?? null,
      photos: meta.photos ?? [],
      formspreeId: meta.formspreeId ?? null,
      multiPage: Boolean(meta.multiPage)
    });
  } catch {
    res.status(404).json({ error: "Site not found" });
  }
});

/** Delete a generated site. */
app.delete("/api/sites/:id", async (req, res) => {
  try {
    await fs.rm(siteDir(req.params.id), { recursive: true });
    await updateIndex(GENERATED_DIR, req.params.id, null);
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Site not found" });
  }
});

/** Download a site as a zip. */
app.get("/api/sites/:id/download", async (req, res) => {
  try {
    const dir = siteDir(req.params.id);
    await fs.access(path.join(dir, "index.html"));
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="website-${req.params.id}.zip"`);
    const archive = archiver("zip");
    archive.pipe(res);
    const meta = await readMeta(dir);
    for (const name of exportFileList(meta)) {
      try {
        await fs.access(path.join(dir, name));
        archive.file(path.join(dir, name), { name });
      } catch { /* older sites may lack extra assets */ }
    }
    await archive.finalize();
  } catch {
    res.status(404).json({ error: "Site not found" });
  }
});

/** Serve generated site previews. */
app.use("/sites", express.static(GENERATED_DIR));

/** Available themes. */
app.get("/api/themes", (_req, res) => res.json(Object.keys(THEMES)));

async function refreshIndexEntry(id, spec) {
  const index = await readIndex(GENERATED_DIR);
  const existing = index.find((e) => e.id === id);
  await updateIndex(GENERATED_DIR, id, {
    businessName: spec.businessName,
    tagline: spec.tagline,
    createdAt: existing?.createdAt ?? new Date().toISOString()
  });
}

function siteDir(id) {
  // prevent path traversal
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw Object.assign(new Error("Invalid id"), { code: "ENOENT" });
  return path.join(GENERATED_DIR, id);
}

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    const mode = process.env.ANTHROPIC_API_KEY ? "Claude API" : "demo (set ANTHROPIC_API_KEY for AI generation)";
    console.log(`website-automation running at http://localhost:${PORT} — mode: ${mode}`);
  });
}

export default app;
