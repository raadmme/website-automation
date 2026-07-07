import express from "express";
import multer from "multer";
import archiver from "archiver";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateSiteSpec, regenerateSection, REGENERATABLE_SECTIONS } from "./lib/generator.js";
import { THEMES } from "./lib/renderer.js";
import { writeSiteFiles, readMeta, exportFileList } from "./lib/site.js";
import { extractText } from "./lib/importers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.join(__dirname, "generated");
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 5 }
});

const LOGO_EXTENSIONS = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg", "image/webp": "webp" };

/** Generate a website from a description, optional documents, and an optional logo. */
app.post("/api/generate", upload.fields([{ name: "documents", maxCount: 5 }, { name: "logo", maxCount: 1 }]), async (req, res) => {
  try {
    const description = (req.body.description || "").trim();
    const theme = req.body.theme || "warm";
    const documents = req.files?.documents ?? [];
    const logoFile = req.files?.logo?.[0];
    if (!description && !documents.length) {
      return res.status(400).json({ error: "Provide a business description or at least one document." });
    }
    if (logoFile && !LOGO_EXTENSIONS[logoFile.mimetype]) {
      return res.status(400).json({ error: "Logo must be a PNG, JPEG, SVG, or WebP image." });
    }

    const docTexts = [];
    for (const file of documents) {
      try {
        const text = await extractText(file.originalname, file.buffer);
        docTexts.push(`--- ${file.originalname} ---\n${text}`);
      } catch (err) {
        return res.status(400).json({ error: `${file.originalname}: ${err.message}` });
      }
    }

    const { spec, mode } = await generateSiteSpec(description, docTexts.join("\n\n"));

    const id = randomUUID().slice(0, 8);
    const dir = path.join(GENERATED_DIR, id);
    const meta = { theme };
    if (logoFile) {
      meta.logo = `logo.${LOGO_EXTENSIONS[logoFile.mimetype]}`;
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, meta.logo), logoFile.buffer);
    }
    await writeSiteFiles(dir, spec, meta);
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
    const { spec: bodySpec, theme } = req.body;
    const spec = bodySpec ?? JSON.parse(await fs.readFile(path.join(dir, "spec.json"), "utf-8"));
    const meta = await readMeta(dir);
    if (theme) {
      if (!THEMES[theme]) return res.status(400).json({ error: `Unknown theme: ${theme}` });
      meta.theme = theme;
    }

    await writeSiteFiles(dir, spec, meta);
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
    res.json({ id: req.params.id, spec, previewUrl: `/sites/${req.params.id}/` });
  } catch (err) {
    if (err.code === "ENOENT") return res.status(404).json({ error: "Site not found" });
    console.error(err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

/** List generated sites. */
app.get("/api/sites", async (_req, res) => {
  const sites = [];
  let entries = [];
  try {
    entries = await fs.readdir(GENERATED_DIR, { withFileTypes: true });
  } catch { /* no generated dir yet */ }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const spec = JSON.parse(await fs.readFile(path.join(GENERATED_DIR, entry.name, "spec.json"), "utf-8"));
      const stat = await fs.stat(path.join(GENERATED_DIR, entry.name, "index.html"));
      sites.push({
        id: entry.name,
        businessName: spec.businessName,
        tagline: spec.tagline,
        createdAt: stat.mtime,
        previewUrl: `/sites/${entry.name}/`
      });
    } catch { /* skip malformed entries */ }
  }
  sites.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sites);
});

/** Fetch a site's editable spec. */
app.get("/api/sites/:id", async (req, res) => {
  try {
    const dir = siteDir(req.params.id);
    const spec = JSON.parse(await fs.readFile(path.join(dir, "spec.json"), "utf-8"));
    const meta = await readMeta(dir);
    res.json({ id: req.params.id, spec, theme: meta.theme, logo: meta.logo ?? null });
  } catch {
    res.status(404).json({ error: "Site not found" });
  }
});

/** Delete a generated site. */
app.delete("/api/sites/:id", async (req, res) => {
  try {
    await fs.rm(siteDir(req.params.id), { recursive: true });
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

function siteDir(id) {
  // prevent path traversal
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw Object.assign(new Error("Invalid id"), { code: "ENOENT" });
  return path.join(GENERATED_DIR, id);
}

app.listen(PORT, () => {
  const mode = process.env.ANTHROPIC_API_KEY ? "Claude API" : "demo (set ANTHROPIC_API_KEY for AI generation)";
  console.log(`website-automation running at http://localhost:${PORT} — mode: ${mode}`);
});
