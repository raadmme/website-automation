import test from "node:test";
import assert from "node:assert/strict";
import { renderPages, renderSitemap, themeFromHue, resolveTheme, PAGE_FILES, THEMES } from "../lib/renderer.js";
import { demoSpec, reviseSpec, generateSiteSpec, SITE_SPEC_SCHEMA } from "../lib/generator.js";
import { exportFileList } from "../lib/site.js";

const spec = demoSpec("Hilltop Bakery is a family-run bakery in Asheville, NC.");

test("renderPages returns a single page by default", () => {
  const pages = renderPages(spec);
  assert.deepEqual(Object.keys(pages), ["index.html"]);
  assert.match(pages["index.html"], /href="#about"/);
});

test("renderPages returns all pages when multiPage", () => {
  const pages = renderPages(spec, { multiPage: true });
  assert.deepEqual(Object.keys(pages).sort(), [...PAGE_FILES].sort());
  for (const html of Object.values(pages)) {
    assert.match(html, /^<!DOCTYPE html>/);
    assert.ok(html.includes('href="about.html"'));
    assert.ok(!html.includes('href="#about"'));
  }
  assert.ok(pages["about.html"].includes(spec.about.heading));
  assert.ok(pages["services.html"].includes(spec.services[0].name));
  assert.ok(pages["contact.html"].includes(spec.contact.email.split("@")[0]));
});

test("menu, team, serviceArea, and bookingUrl render when present", () => {
  const rich = {
    ...spec,
    menu: [{ name: "Sourdough Loaf", description: "Naturally leavened.", price: "$9" }],
    team: [{ name: "Ada Baker", role: "Head Baker", bio: "Twenty years at the oven." }],
    serviceArea: "Serving Asheville and surrounding areas",
    bookingUrl: "https://example.com/book"
  };
  const html = renderPages(rich)["index.html"];
  assert.ok(html.includes("Sourdough Loaf"));
  assert.ok(html.includes("$9"));
  assert.ok(html.includes("Ada Baker"));
  assert.ok(html.includes("Serving Asheville and surrounding areas"));
  assert.ok(html.includes('href="https://example.com/book"'));
  // Optional sections omitted -> not rendered
  const plain = renderPages(spec)["index.html"];
  assert.ok(!plain.includes('class="menu-item"'));
  assert.ok(!plain.includes('class="card team-card"'));
});

test("editable elements carry data-edit attributes", () => {
  const html = renderPages(spec)["index.html"];
  assert.ok(html.includes('data-edit="hero.headline"'));
  assert.ok(html.includes('data-edit="services.0.name"'));
  assert.ok(html.includes('data-multiline="true"'));
});

test("themeFromHue builds a full palette and resolveTheme uses it", () => {
  const t = themeFromHue(200);
  for (const key of Object.keys(THEMES.warm)) assert.ok(t[key], `missing ${key}`);
  assert.equal(t.primary, "200 50% 33%");
  assert.equal(themeFromHue(-160).primary, "200 50% 33%");
  assert.equal(resolveTheme({ theme: "custom", hue: 200 }).primary, "200 50% 33%");
  assert.equal(resolveTheme({ theme: "custom", hue: "nope" }), THEMES.warm);
  assert.equal(resolveTheme({ theme: "forest" }), THEMES.forest);
});

test("sitemap lists all pages when multiPage", () => {
  const single = renderSitemap();
  assert.ok(single.includes("your-domain.example/</loc>"));
  assert.ok(!single.includes("about.html"));
  const multi = renderSitemap({ multiPage: true });
  for (const p of PAGE_FILES.slice(1)) assert.ok(multi.includes(p), `sitemap missing ${p}`);
});

test("exportFileList includes pages and photos per meta", () => {
  const single = exportFileList({ theme: "warm" });
  assert.ok(single.includes("index.html"));
  assert.ok(!single.includes("about.html"));
  const multi = exportFileList({ theme: "warm", multiPage: true, logo: "logo.png", photos: ["photo-1.jpg"] });
  for (const p of PAGE_FILES) assert.ok(multi.includes(p));
  assert.ok(multi.includes("logo.png"));
  assert.ok(multi.includes("photo-1.jpg"));
});

test("gallery renders uploaded photos", () => {
  const html = renderPages(spec, { photos: ["photo-1.jpg", "photo-2.png"] })["index.html"];
  assert.ok(html.includes('src="photo-1.jpg"'));
  assert.ok(html.includes('src="photo-2.png"'));
  assert.ok(html.includes("gallery-grid"));
  assert.ok(!renderPages(spec)["index.html"].includes('id="gallery"'));
});

test("formspreeId switches the contact form to a POST form", () => {
  const html = renderPages(spec, { formspreeId: "mzbqwxyz" })["index.html"];
  assert.ok(html.includes('action="https://formspree.io/f/mzbqwxyz"'));
  assert.ok(!html.includes("mailto:"));
  const plain = renderPages(spec)["index.html"];
  assert.ok(plain.includes("mailto:"));
  assert.ok(!plain.includes("formspree.io"));
});

test("custom hue renders into the page palette", () => {
  const html = renderPages(spec, { theme: "custom", hue: 200 })["index.html"];
  assert.ok(html.includes("--primary: 200 50% 33%"));
});

test("reviseSpec requires an API key with a friendly 400", async (t) => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  t.after(() => { if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved; });
  await assert.rejects(reviseSpec(spec, "make it warmer"), (err) => err.status === 400);
});

test("generateSiteSpec falls back to demo mode without an API key", async (t) => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  t.after(() => { if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved; });
  const { spec: s, mode } = await generateSiteSpec("A tiny bookshop.", "", [{ mediaType: "image/png", data: "aGk=" }]);
  assert.equal(mode, "demo");
  assert.ok(s.businessName);
});

test("publishSite validates repository names before doing anything", async () => {
  const { publishSite, REPO_NAME_RE } = await import("../lib/publish.js");
  for (const bad of ["", "has space", "UPPER_case!", "-leading", "a".repeat(65), "evil/../repo"]) {
    assert.ok(!REPO_NAME_RE.test(bad), `should reject "${bad}"`);
    await assert.rejects(publishSite("/tmp/nowhere", bad), (err) => err.status === 400);
  }
  assert.ok(REPO_NAME_RE.test("site-abc123"));
});

test("schema marks industry sections optional", () => {
  for (const key of ["menu", "team", "serviceArea", "bookingUrl"]) {
    assert.ok(SITE_SPEC_SCHEMA.properties[key], `schema missing ${key}`);
    assert.ok(!SITE_SPEC_SCHEMA.required.includes(key), `${key} must be optional`);
  }
});
