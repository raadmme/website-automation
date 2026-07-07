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

/** Files that belong in a site export, in order. */
export function exportFileList(meta) {
  const files = ["index.html", "favicon.svg", "robots.txt", "sitemap.xml", "DEPLOY.md"];
  if (meta.logo) files.push(meta.logo);
  return files;
}
