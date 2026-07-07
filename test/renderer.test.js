import test from "node:test";
import assert from "node:assert/strict";
import { renderSite, THEMES, esc } from "../lib/renderer.js";
import { demoSpec } from "../lib/generator.js";
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

test("extractText handles txt and rejects unknown types", async () => {
  const text = await extractText("notes.txt", Buffer.from("hello world"));
  assert.equal(text, "hello world");
  await assert.rejects(() => extractText("photo.heic", Buffer.from("")), /Unsupported file type/);
});
