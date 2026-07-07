/**
 * Renders a site spec into a self-contained static website (single index.html).
 * Look & feel follows the Annum brand guidelines: warm earth tones, serif
 * display type (Cinzel), Spectral body text, pill buttons, generous radii,
 * and subtle radial-warmth gradients.
 */

export function renderSite(spec, options = {}) {
  const theme = THEMES[options.theme] ?? THEMES.warm;
  return html(spec, theme);
}

/**
 * SVG favicon: the business's initial as a serif monogram on a
 * theme-colored rounded tile.
 */
export function renderFavicon(spec, options = {}) {
  const theme = THEMES[options.theme] ?? THEMES.warm;
  const initial = esc((spec.businessName ?? "A").trim().charAt(0).toUpperCase() || "A");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="hsl(${theme.primary})"/>
  <text x="32" y="44" text-anchor="middle" font-family="Cinzel, Georgia, serif"
    font-size="34" fill="hsl(${theme.primaryForeground})">${initial}</text>
</svg>
`;
}

/** robots.txt for the exported site. */
export function renderRobots() {
  return "User-agent: *\nAllow: /\n\nSitemap: /sitemap.xml\n";
}

/**
 * sitemap.xml for the exported site. The domain is a placeholder the owner
 * replaces after deploying.
 */
export function renderSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Replace https://your-domain.example with your site's URL after deploying -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://your-domain.example/</loc>
    <lastmod>${today}</lastmod>
  </url>
</urlset>
`;
}

export const THEMES = {
  warm: {
    background: "35 25% 96%",
    foreground: "25 20% 15%",
    primary: "25 55% 35%",
    primaryForeground: "40 30% 98%",
    muted: "35 12% 88%",
    mutedForeground: "25 12% 45%",
    card: "40 30% 94%",
    border: "35 15% 85%"
  },
  forest: {
    background: "80 20% 96%",
    foreground: "140 20% 12%",
    primary: "150 40% 26%",
    primaryForeground: "80 30% 98%",
    muted: "90 12% 88%",
    mutedForeground: "140 10% 40%",
    card: "85 25% 94%",
    border: "90 15% 84%"
  },
  slate: {
    background: "215 25% 97%",
    foreground: "220 25% 14%",
    primary: "220 45% 32%",
    primaryForeground: "215 30% 98%",
    muted: "215 15% 90%",
    mutedForeground: "220 10% 42%",
    card: "215 30% 95%",
    border: "215 15% 86%"
  },
  wine: {
    background: "20 25% 96%",
    foreground: "350 25% 14%",
    primary: "350 50% 32%",
    primaryForeground: "20 30% 98%",
    muted: "10 12% 89%",
    mutedForeground: "350 10% 42%",
    card: "15 28% 94%",
    border: "10 15% 85%"
  }
};

export function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const paragraphs = (text) =>
  String(text ?? "")
    .split(/\n\n+/)
    .map((p) => `<p>${esc(p.trim())}</p>`)
    .join("\n");

function html(spec, t) {
  const services = (spec.services ?? [])
    .map(
      (s) => `
        <div class="card">
          <h3>${esc(s.name)}</h3>
          <p>${esc(s.description)}</p>
        </div>`
    )
    .join("\n");

  const testimonials = (spec.testimonials ?? [])
    .map(
      (q) => `
        <figure class="card quote">
          <blockquote>&ldquo;${esc(q.quote)}&rdquo;</blockquote>
          <figcaption>&mdash; ${esc(q.author)}</figcaption>
        </figure>`
    )
    .join("\n");

  const faq = (spec.faq ?? [])
    .map(
      (f) => `
        <details class="card faq-item">
          <summary>${esc(f.question)}</summary>
          <p>${esc(f.answer)}</p>
        </details>`
    )
    .join("\n");

  const c = spec.contact ?? {};

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(spec.businessName)} — ${esc(spec.tagline)}</title>
<meta name="description" content="${esc(spec.hero?.subheadline ?? spec.tagline)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(spec.businessName)} — ${esc(spec.tagline)}">
<meta property="og:description" content="${esc(spec.hero?.subheadline ?? spec.tagline)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(spec.businessName)}">
<meta name="twitter:description" content="${esc(spec.hero?.subheadline ?? spec.tagline)}">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Source+Code+Pro:wght@400;500;600&family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>
:root {
  --background: ${t.background};
  --foreground: ${t.foreground};
  --primary: ${t.primary};
  --primary-foreground: ${t.primaryForeground};
  --muted: ${t.muted};
  --muted-foreground: ${t.mutedForeground};
  --card: ${t.card};
  --border: ${t.border};
  --font-serif: 'Cinzel', Georgia, serif;
  --font-sans: 'Spectral', Georgia, serif;
  --font-mono: 'Source Code Pro', Menlo, monospace;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: var(--font-sans);
  line-height: 1.625;
  font-size: 1rem;
}
.wrap { max-width: 68rem; margin: 0 auto; padding: 0 1.5rem; }

header.site {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.5rem 0;
}
.brand {
  font-family: var(--font-serif);
  text-transform: uppercase;
  letter-spacing: 0.25em;
  font-size: 1.5rem;
  font-weight: 400;
}
nav.site a {
  color: hsl(var(--muted-foreground));
  text-decoration: none;
  margin-left: 1.5rem;
  font-size: 0.9rem;
}
nav.site a:hover { color: hsl(var(--foreground)); }

.hero {
  position: relative;
  text-align: center;
  padding: 6rem 1.5rem 5rem;
  background:
    radial-gradient(60rem 30rem at 50% -10%, hsl(var(--primary) / 0.08), transparent 70%),
    radial-gradient(40rem 20rem at 85% 20%, hsl(var(--primary) / 0.05), transparent 70%);
}
.hero .tagline {
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  margin-bottom: 1.25rem;
}
.hero h1 {
  font-family: var(--font-serif);
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  letter-spacing: -0.01em;
  max-width: 48rem;
  margin: 0 auto 1.25rem;
}
.hero p.sub {
  color: hsl(var(--muted-foreground));
  max-width: 40rem;
  margin: 0 auto 2.25rem;
  font-size: 1.125rem;
}
.btn {
  display: inline-block;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-radius: 9999px;
  padding: 0.75rem 1.75rem;
  text-decoration: none;
  font-size: 0.95rem;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.btn:hover { box-shadow: 0 4px 14px hsl(var(--foreground) / 0.15); transform: translateY(-1px); }

section { padding: 4rem 0; }
section h2 {
  font-family: var(--font-serif);
  font-size: 1.875rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  text-align: center;
  margin-bottom: 2.5rem;
}
.about-body { max-width: 44rem; margin: 0 auto; }
.about-body p + p { margin-top: 1.25rem; }

.grid {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
}
.card {
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border) / 0.7);
  border-radius: 28px;
  padding: 1.5rem;
}
.card h3 { font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; }
.card p { color: hsl(var(--muted-foreground)); font-size: 0.95rem; }

.quote blockquote { font-style: italic; margin-bottom: 0.75rem; }
.quote figcaption { color: hsl(var(--muted-foreground)); font-size: 0.875rem; }

.faq-list { max-width: 44rem; margin: 0 auto; display: grid; gap: 0.9rem; }
.faq-item { border-radius: 0.75rem; padding: 1.1rem 1.4rem; }
.faq-item summary { cursor: pointer; font-weight: 600; }
.faq-item p { margin-top: 0.6rem; }

.contact-grid {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  max-width: 52rem;
  margin: 0 auto;
  text-align: center;
}
.contact-grid .label {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.7rem;
  color: hsl(var(--muted-foreground));
  margin-bottom: 0.4rem;
}
.contact-grid .value { font-family: var(--font-mono); font-size: 0.95rem; }

footer.site {
  border-top: 1px solid hsl(var(--border));
  padding: 2.5rem 0 3rem;
  text-align: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.85rem;
}
footer.site .brand { font-size: 1rem; margin-bottom: 0.75rem; }
</style>
</head>
<body>
<div class="wrap">
  <header class="site">
    <div class="brand">${esc(spec.businessName)}</div>
    <nav class="site">
      <a href="#about">About</a>
      <a href="#services">Services</a>
      <a href="#faq">FAQ</a>
      <a href="#contact">Contact</a>
    </nav>
  </header>
</div>

<div class="hero">
  <div class="tagline">${esc(spec.tagline)}</div>
  <h1>${esc(spec.hero?.headline)}</h1>
  <p class="sub">${esc(spec.hero?.subheadline)}</p>
  <a class="btn" href="#contact">${esc(spec.hero?.cta ?? "Get in Touch")}</a>
</div>

<div class="wrap">
  <section id="about">
    <h2>${esc(spec.about?.heading ?? "About")}</h2>
    <div class="about-body">${paragraphs(spec.about?.body)}</div>
  </section>

  <section id="services">
    <h2>Services</h2>
    <div class="grid">${services}</div>
  </section>

  ${testimonials ? `<section id="testimonials">
    <h2>What Clients Say</h2>
    <div class="grid">${testimonials}</div>
  </section>` : ""}

  ${faq ? `<section id="faq">
    <h2>Frequently Asked Questions</h2>
    <div class="faq-list">${faq}</div>
  </section>` : ""}

  <section id="contact">
    <h2>Contact</h2>
    <div class="contact-grid">
      <div><div class="label">Email</div><div class="value">${esc(c.email)}</div></div>
      <div><div class="label">Phone</div><div class="value">${esc(c.phone)}</div></div>
      <div><div class="label">Address</div><div class="value">${esc(c.address)}</div></div>
      <div><div class="label">Hours</div><div class="value">${esc(c.hours)}</div></div>
    </div>
  </section>
</div>

<footer class="site">
  <div class="brand">${esc(spec.businessName)}</div>
  <div>${esc(spec.footerNote)}</div>
</footer>
</body>
</html>`;
}
