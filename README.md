# Website Automation

Generate a polished, professional website for a small business from a short
description — or from documents you already have (brochures, business plans,
notes in txt / md / csv / pdf / docx).

Generated sites follow a warm, understated design system: serif display type
(Cinzel), Spectral body text, earth-tone palettes, pill buttons, and generous
rounded cards.

## Quick start

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # optional, but recommended
npm start
```

Open http://localhost:3000.

Or generate a site headlessly from the command line:

```bash
node cli.js "Hilltop Bakery is a family-run bakery in Asheville..." --theme warm --out ./site
node cli.js --file brochure.pdf --file notes.txt --out ./site
```

Without an `ANTHROPIC_API_KEY` the app runs in **demo mode**: the full
pipeline works (import → content → render → preview → download) but content
is templated rather than AI-written.

## How it works

1. **Import** — you type a description and/or upload documents. Text is
   extracted server-side (`lib/importers.js`).
2. **Generate** — Claude (`claude-opus-4-6`) turns the input into a structured
   site spec (business name, hero, about, services, testimonials, FAQ,
   contact) using structured outputs (`lib/generator.js`).
3. **Render** — the spec is rendered into a single self-contained
   `index.html` with the brand design system baked in (`lib/renderer.js`).
4. **Preview & export** — preview in the browser, edit the content JSON and
   re-render, switch color themes, regenerate individual sections with AI,
   or download the site as a ZIP.

Exported ZIPs include `index.html`, a themed SVG favicon, `robots.txt`,
a `sitemap.xml` template, and a `DEPLOY.md` with GitHub Pages / Netlify
instructions.

## API

| Method | Path                      | Description                          |
|--------|---------------------------|--------------------------------------|
| POST   | `/api/generate`           | multipart: `description`, `theme`, `documents[]`, `logo` |
| GET    | `/api/sites`              | list generated sites                 |
| GET    | `/api/sites/:id`          | fetch a site's editable spec         |
| POST   | `/api/sites/:id/render`   | re-render with edited spec / theme   |
| POST   | `/api/sites/:id/regenerate` | AI-rewrite one section (`section`, `instructions`) |
| GET    | `/api/sites/:id/download` | download the site as a ZIP           |
| DELETE | `/api/sites/:id`          | delete a generated site              |
| GET    | `/api/themes`             | available color themes               |

## Themes

`warm` (default), `forest`, `slate`, `wine` — all share the same typographic
system and layout; only the palette shifts.

## Tests

```bash
npm test
```
