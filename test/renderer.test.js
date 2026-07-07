import test from "node:test";
import assert from "node:assert/strict";
import { renderSite, renderFavicon, renderRobots, renderSitemap, THEMES, esc } from "../lib/renderer.js";
import { demoSpec, regenerateSection, REGENERATABLE_SECTIONS } from "../lib/generator.js";
import { renderDeployGuide } from "../lib/renderer.js";
import { extractText } from "../lib/importers.js";

const spec = demoSpec("Hilltop Bakery is a family-run bakery in Asheville, NC.");

test("demoSpec produces a complete spec", () => {
  for (const key of ["businessName", "tagline", "hero", "about", "services", "testimonials", "faq", "contact", "footerNote"]) {
    assert.ok(spec[key], `missing ${key}`);
  }
  assert.ok(spec.services.length >= 3);
});

test("renderSite produces valid-looking HTML with brand fonts", () => {
  const html = renderSite(spec);
  assert.match(html, /^<!DOCTYPE html>/);
  assert.ok(html.includes("Cinzel"));
  assert.ok(html.includes("Spectral"));
  assert.ok(html.includes(spec.businessName));
  assert.ok(html.includes("border-radius: 28px"));
  assert.ok(html.includes("border-radius: 9999px"));
});

test("all themes render", () => {
  for (const theme of Object.keys(THEMES)) {
    const html = renderSite(spec, { theme });
    assert.ok(html.includes(`--primary: ${THEMES[theme].primary}`), `theme ${theme}`);
  }
});

test("html is escaped", () => {
  const evil = { ...spec, businessName: '<script>alert("x")</script>' };
  const html = renderSite(evil);
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("esc escapes special characters", () => {
  assert.equal(esc(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
});

test("rendered site includes SEO meta and favicon link", () => {
  const html = renderSite(spec);
  assert.ok(html.includes('property="og:title"'));
  assert.ok(html.includes('name="twitter:card"'));
  assert.ok(html.includes('href="favicon.svg"'));
});

test("renderFavicon produces a themed SVG monogram", () => {
  const svg = renderFavicon(spec, { theme: "forest" });
  assert.match(svg, /^<svg /);
  assert.ok(svg.includes(`hsl(${THEMES.forest.primary})`));
  assert.ok(svg.includes(">H</text>")); // Hilltop -> H
});

test("renderRobots and renderSitemap produce valid output", () => {
  assert.match(renderRobots(), /User-agent: \*/);
  assert.match(renderSitemap(), /<urlset/);
});

test("demoSpec uses document text when description is empty", () => {
  const s = demoSpec("", "--- notes.txt ---\nRiver Bend Plumbing serves the whole valley.");
  assert.equal(s.businessName, "River Bend Plumbing");
});

test("rendered site includes hero ornament and contact form", () => {
  const html = renderSite(spec);
  assert.ok(html.includes('class="ornament"'));
  assert.ok(html.includes('id="contact-form"'));
  assert.ok(html.includes("mailto:"));
});

test("contact form email cannot break out of the script tag", () => {
  const evil = { ...spec, contact: { ...spec.contact, email: '</script><script>alert(1)</script>' } };
  const html = renderSite(evil);
  assert.ok(!html.includes("</script><script>alert(1)"));
});

test("renderDeployGuide mentions the business and hosting options", () => {
  const guide = renderDeployGuide(spec);
  assert.ok(guide.includes(spec.businessName));
  assert.ok(guide.includes("GitHub Pages"));
  assert.ok(guide.includes("Netlify"));
});

test("regenerateSection rejects unknown sections", async () => {
  await assert.rejects(() => regenerateSection(spec, "nonsense"), /Unknown section/);
  assert.ok(REGENERATABLE_SECTIONS.includes("hero"));
});

test("renderSite includes logo image when provided", () => {
  const html = renderSite(spec, { logo: "logo.png" });
  assert.ok(html.includes('<img class="logo" src="logo.png"'));
  assert.ok(!renderSite(spec).includes('<img class="logo"'));
});

test("extractText handles txt and rejects unknown types", async () => {
  const text = await extractText("notes.txt", Buffer.from("hello world"));
  assert.equal(text, "hello world");
  await assert.rejects(() => extractText("photo.heic", Buffer.from("")), /Unsupported file type/);
});
