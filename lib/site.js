import fs from "node:fs/promises";
import path from "node:path";
import { renderPages, renderFavicon, renderRobots, renderSitemap, renderDeployGuide, PAGE_FILES } from "./renderer.js";

/**
 * Write all files for a generated site into `dir`.
 * meta: { theme, hue?, logo?, photos?, formspreeId?, multiPage? } — logo and
 * photos are filenames already present (or about to be written) in `dir`.
 */
export async function writeSiteFiles(dir, spec, meta) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "spec.json"), JSON.stringify(spec, null, 2));
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  const pages = renderPages(spec, meta);
  for (const [name, html] of Object.entries(pages)) {
    await fs.writeFile(path.join(dir, name), html);
  }
  // Remove stale page files if the site was switched back to single-page.
  for (const name of PAGE_FILES) {
    if (!pages[name]) await fs.rm(path.join(dir, name), { force: true });
  }
  await fs.writeFile(path.join(dir, "favicon.svg"), renderFavicon(spec, meta));
  await fs.writeFile(path.join(dir, "robots.txt"), renderRobots());
  await fs.writeFile(path.join(dir, "sitemap.xml"), renderSitemap(meta));
  await fs.writeFile(path.join(dir, "DEPLOY.md"), renderDeployGuide(spec));
}

/** Read a site's meta.json, defaulting sensibly. */
export async function readMeta(dir) {
  try {
    const meta = JSON.parse(await fs.readFile(path.join(dir, "meta.json"), "utf-8"));
    return { theme: "warm", ...meta };
  } catch {
    return { theme: "warm" };
  }
}

/**
 * Sites index cache (generated/index.json) so listing does not scan every
 * site directory on each request. Falls back to a full rebuild if missing.
 */
export async function readIndex(generatedDir) {
  try {
    return JSON.parse(await fs.readFile(path.join(generatedDir, "index.json"), "utf-8"));
  } catch {
    return rebuildIndex(generatedDir);
  }
}

export async function updateIndex(generatedDir, id, entry) {
  const index = await readIndex(generatedDir);
  const next = index.filter((e) => e.id !== id);
  if (entry) next.push({ id, ...entry });
  next.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  await fs.mkdir(generatedDir, { recursive: true });
  await fs.writeFile(path.join(generatedDir, "index.json"), JSON.stringify(next, null, 2));
  return next;
}

export async function rebuildIndex(generatedDir) {
  const index = [];
  let entries = [];
  try {
    entries = await fs.readdir(generatedDir, { withFileTypes: true });
  } catch {
    return index;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const spec = JSON.parse(await fs.readFile(path.join(generatedDir, entry.name, "spec.json"), "utf-8"));
      const stat = await fs.stat(path.join(generatedDir, entry.name, "index.html"));
      index.push({
        id: entry.name,
        businessName: spec.businessName,
        tagline: spec.tagline,
        createdAt: stat.mtime.toISOString()
      });
    } catch { /* skip malformed entries */ }
  }
  index.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  try {
    await fs.writeFile(path.join(generatedDir, "index.json"), JSON.stringify(index, null, 2));
  } catch { /* generatedDir may not exist yet */ }
  return index;
}

/** Files that belong in a site export, in order. */
export function exportFileList(meta) {
  const files = meta.multiPage ? [...PAGE_FILES] : ["index.html"];
  files.push("favicon.svg", "robots.txt", "sitemap.xml", "DEPLOY.md");
  if (meta.logo) files.push(meta.logo);
  for (const photo of meta.photos ?? []) files.push(photo);
  return files;
}
