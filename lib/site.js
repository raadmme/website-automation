import fs from "node:fs/promises";
import path from "node:path";
import { renderSite, renderFavicon, renderRobots, renderSitemap, renderDeployGuide } from "./renderer.js";

/**
 * Write all files for a generated site into `dir`.
 * meta: { theme: string, logo?: string } — logo is a filename already
 * present (or about to be written) in the same directory.
 */
export async function writeSiteFiles(dir, spec, meta) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "spec.json"), JSON.stringify(spec, null, 2));
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  await fs.writeFile(path.join(dir, "index.html"), renderSite(spec, meta));
  await fs.writeFile(path.join(dir, "favicon.svg"), renderFavicon(spec, meta));
  await fs.writeFile(path.join(dir, "robots.txt"), renderRobots());
  await fs.writeFile(path.join(dir, "sitemap.xml"), renderSitemap());
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
  const files = ["index.html", "favicon.svg", "robots.txt", "sitemap.xml", "DEPLOY.md"];
  if (meta.logo) files.push(meta.logo);
  return files;
}
