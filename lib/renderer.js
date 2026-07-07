/**
 * Renders a site spec into a static website (single- or multi-page).
 * Look & feel follows the Annum brand guidelines: warm earth tones, serif
 * display type (Cinzel), Spectral body text, pill buttons, generous radii,
 * and subtle radial-warmth gradients.
 *
 * Editable text nodes carry `data-edit` attributes (spec paths) used by the
 * app's visual editing mode; they are inert in the exported site.
 */

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

/** Derive a full palette from a single hue (0-360) for custom themes. */
export function themeFromHue(hue) {
  const h = Math.round(((hue % 360) + 360) % 360);
  return {
    background: `${h} 25% 96%`,
    foreground: `${h} 20% 15%`,
    primary: `${h} 50% 33%`,
    primaryForeground: `${h} 30% 98%`,
    muted: `${h} 12% 88%`,
    mutedForeground: `${h} 12% 45%`,
    card: `${h} 28% 94%`,
    border: `${h} 15% 85%`
  };
}

export function resolveTheme(options = {}) {
  if (options.theme === "custom" && Number.isFinite(Number(options.hue))) {
    return themeFromHue(Number(options.hue));
  }
  return THEMES[options.theme] ?? THEMES.warm;
}

export function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const attr = (path) => `data-edit="${path}"`;

const paragraphs = (text, editPath) =>
  `<div class="prose" ${editPath ? `${attr(editPath)} data-multiline="true"` : ""}>` +
  String(text ?? "")
    .split(/\n\n+/)
    .map((p) => `<p>${esc(p.trim())}</p>`)
    .join("\n") +
  `</div>`;

/* ------------------------------------------------------------------ */
/* Public entry points                                                  */
/* ------------------------------------------------------------------ */

/** Render a complete single-page site (back-compat entry point). */
export function renderSite(spec, options = {}) {
  return renderPages(spec, { ...options, multiPage: false })["index.html"];
}

/**
 * Render a site as one or more pages.
 * Returns an object mapping filename -> HTML.
 */
export function renderPages(spec, options = {}) {
  const t = resolveTheme(options);
  const ctx = {
    spec,
    t,
    logo: options.logo,
    photos: options.photos ?? [],
    formspreeId: options.formspreeId,
    multiPage: Boolean(options.multiPage)
  };

  if (!ctx.multiPage) {
    const body = [
      hero(ctx),
      `<div class="wrap">`,
      about(ctx),
      services(ctx),
      menu(ctx),
      team(ctx),
      gallery(ctx),
      testimonials(ctx),
      faq(ctx),
      contact(ctx),
      `</div>`
    ].join("\n");
    return { "index.html": page(ctx, { body, title: null, contactScript: true }) };
  }

  const pages = {
    "index.html": page(ctx, {
      body: [hero(ctx), `<div class="wrap">`, testimonials(ctx), gallery(ctx), `</div>`].join("\n"),
      title: null
    }),
    "about.html": page(ctx, {
      body: [`<div class="wrap page-pad">`, about(ctx), team(ctx), `</div>`].join("\n"),
      title: "About"
    }),
    "services.html": page(ctx, {
      body: [`<div class="wrap page-pad">`, services(ctx), menu(ctx), faq(ctx), `</div>`].join("\n"),
      title: "Services"
    }),
    "contact.html": page(ctx, {
      body: [`<div class="wrap page-pad">`, contact(ctx), `</div>`].join("\n"),
      title: "Contact",
      contactScript: true
    })
  };
  return pages;
}

export const PAGE_FILES = ["index.html", "about.html", "services.html", "contact.html"];

/* ------------------------------------------------------------------ */
/* Sections                                                             */
/* ------------------------------------------------------------------ */

function navLinks(ctx) {
  if (ctx.multiPage) {
    return `
      <a href="index.html">Home</a>
      <a href="about.html">About</a>
      <a href="services.html">Services</a>
      <a href="contact.html">Contact</a>`;
  }
  return `
      <a href="#about">About</a>
      <a href="#services">Services</a>
      <a href="#faq">FAQ</a>
      <a href="#contact">Contact</a>`;
}

function hero(ctx) {
  const { spec, t } = ctx;
  const contactHref = ctx.multiPage ? "contact.html" : "#contact";
  const booking = spec.bookingUrl
    ? `<a class="btn btn-outline" href="${esc(spec.bookingUrl)}" target="_blank" rel="noopener">Book Online</a>`
    : "";
  return `
<div class="hero">
  <div class="tagline" ${attr("tagline")}>${esc(spec.tagline)}</div>
  <h1 ${attr("hero.headline")}>${esc(spec.hero?.headline)}</h1>
  <div class="ornament" aria-hidden="true">
    <svg width="160" height="12" viewBox="0 0 160 12" fill="none">
      <line x1="0" y1="6" x2="68" y2="6" stroke="hsl(${t.primary} / 0.45)" stroke-width="1"/>
      <rect x="76" y="2" width="8" height="8" transform="rotate(45 80 6)" fill="hsl(${t.primary} / 0.55)"/>
      <line x1="92" y1="6" x2="160" y2="6" stroke="hsl(${t.primary} / 0.45)" stroke-width="1"/>
    </svg>
  </div>
  <p class="sub" ${attr("hero.subheadline")}>${esc(spec.hero?.subheadline)}</p>
  <div class="hero-actions">
    <a class="btn" href="${contactHref}" ${attr("hero.cta")}>${esc(spec.hero?.cta ?? "Get in Touch")}</a>
    ${booking}
  </div>
</div>`;
}

function about(ctx) {
  const { spec } = ctx;
  return `
<section id="about">
  <h2 ${attr("about.heading")}>${esc(spec.about?.heading ?? "About")}</h2>
  <div class="about-body">${paragraphs(spec.about?.body, "about.body")}</div>
</section>`;
}

function services(ctx) {
  const items = (ctx.spec.services ?? [])
    .map(
      (s, i) => `
    <div class="card">
      <h3 ${attr(`services.${i}.name`)}>${esc(s.name)}</h3>
      <p ${attr(`services.${i}.description`)}>${esc(s.description)}</p>
    </div>`
    )
    .join("\n");
  if (!items) return "";
  return `
<section id="services">
  <h2>Services</h2>
  <div class="grid">${items}</div>
</section>`;
}

function menu(ctx) {
  const items = (ctx.spec.menu ?? [])
    .map(
      (m, i) => `
    <div class="menu-item">
      <div class="menu-line">
        <span class="menu-name" ${attr(`menu.${i}.name`)}>${esc(m.name)}</span>
        <span class="menu-dots"></span>
        <span class="menu-price" ${attr(`menu.${i}.price`)}>${esc(m.price)}</span>
      </div>
      <p class="menu-desc" ${attr(`menu.${i}.description`)}>${esc(m.description)}</p>
    </div>`
    )
    .join("\n");
  if (!items) return "";
  return `
<section id="menu">
  <h2>Menu</h2>
  <div class="menu-list card">${items}</div>
</section>`;
}

function team(ctx) {
  const items = (ctx.spec.team ?? [])
    .map(
      (m, i) => `
    <div class="card team-card">
      <h3 ${attr(`team.${i}.name`)}>${esc(m.name)}</h3>
      <div class="team-role" ${attr(`team.${i}.role`)}>${esc(m.role)}</div>
      <p ${attr(`team.${i}.bio`)}>${esc(m.bio)}</p>
    </div>`
    )
    .join("\n");
  if (!items) return "";
  return `
<section id="team">
  <h2>Our Team</h2>
  <div class="grid">${items}</div>
</section>`;
}

function gallery(ctx) {
  const items = ctx.photos
    .map((p) => `<img src="${esc(p)}" alt="" loading="lazy">`)
    .join("\n");
  if (!items) return "";
  return `
<section id="gallery">
  <h2>Gallery</h2>
  <div class="gallery-grid">${items}</div>
</section>`;
}

function testimonials(ctx) {
  const items = (ctx.spec.testimonials ?? [])
    .map(
      (q, i) => `
    <figure class="card quote">
      <blockquote ${attr(`testimonials.${i}.quote`)}>&ldquo;${esc(q.quote)}&rdquo;</blockquote>
      <figcaption ${attr(`testimonials.${i}.author`)}>&mdash; ${esc(q.author)}</figcaption>
    </figure>`
    )
    .join("\n");
  if (!items) return "";
  return `
<section id="testimonials">
  <h2>What Clients Say</h2>
  <div class="grid">${items}</div>
</section>`;
}

function faq(ctx) {
  const items = (ctx.spec.faq ?? [])
    .map(
      (f, i) => `
    <details class="card faq-item">
      <summary ${attr(`faq.${i}.question`)}>${esc(f.question)}</summary>
      <p ${attr(`faq.${i}.answer`)}>${esc(f.answer)}</p>
    </details>`
    )
    .join("\n");
  if (!items) return "";
  return `
<section id="faq">
  <h2>Frequently Asked Questions</h2>
  <div class="faq-list">${items}</div>
</section>`;
}

function contact(ctx) {
  const { spec } = ctx;
  const c = spec.contact ?? {};
  const serviceArea = spec.serviceArea
    ? `<p class="service-area" ${attr("serviceArea")}>Serving ${esc(spec.serviceArea)}</p>`
    : "";

  const form = ctx.formspreeId
    ? `
    <form class="contact-form card" action="https://formspree.io/f/${esc(ctx.formspreeId)}" method="POST">
      <h3>Send a message</h3>
      <label for="cf-name">Your name</label>
      <input id="cf-name" name="name" type="text" required>
      <label for="cf-email">Your email</label>
      <input id="cf-email" name="email" type="email" required>
      <label for="cf-message">Message</label>
      <textarea id="cf-message" name="message" rows="5" required></textarea>
      <button type="submit" class="btn">Send Message</button>
    </form>`
    : `
    <form class="contact-form card" id="contact-form">
      <h3>Send a message</h3>
      <label for="cf-name">Your name</label>
      <input id="cf-name" type="text" required>
      <label for="cf-message">Message</label>
      <textarea id="cf-message" rows="5" required></textarea>
      <button type="submit" class="btn">Compose Email</button>
      <p class="form-note">Opens your email app with a message addressed to ${esc(c.email)}.</p>
    </form>`;

  return `
<section id="contact">
  <h2>Contact</h2>
  ${serviceArea}
  <div class="contact-grid">
    <div><div class="label">Email</div><div class="value" ${attr("contact.email")}>${esc(c.email)}</div></div>
    <div><div class="label">Phone</div><div class="value" ${attr("contact.phone")}>${esc(c.phone)}</div></div>
    <div><div class="label">Address</div><div class="value" ${attr("contact.address")}>${esc(c.address)}</div></div>
    <div><div class="label">Hours</div><div class="value" ${attr("contact.hours")}>${esc(c.hours)}</div></div>
  </div>
  ${form}
</section>`;
}

function contactScriptTag(ctx) {
  if (ctx.formspreeId) return "";
  const email = JSON.stringify(String(ctx.spec.contact?.email ?? "")).replace(/</g, "\\u003c");
  return `
<script>
(function () {
  var form = document.getElementById("contact-form");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = document.getElementById("cf-name").value;
    var message = document.getElementById("cf-message").value;
    var subject = encodeURIComponent("Website inquiry from " + name);
    var body = encodeURIComponent(message + "\\n\\n— " + name);
    window.location.href = "mailto:" + ${email} + "?subject=" + subject + "&body=" + body;
  });
})();
</script>`;
}

/* ------------------------------------------------------------------ */
/* Page shell                                                           */
/* ------------------------------------------------------------------ */

function page(ctx, { body, title, contactScript = false }) {
  const { spec, t } = ctx;
  const fullTitle = title
    ? `${title} — ${esc(spec.businessName)}`
    : `${esc(spec.businessName)} — ${esc(spec.tagline)}`;
  const description = esc(spec.hero?.subheadline ?? spec.tagline);
  const logoImg = ctx.logo
    ? `<img class="logo" src="${esc(ctx.logo)}" alt="${esc(spec.businessName)} logo">`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${fullTitle}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${description}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(spec.businessName)}">
<meta name="twitter:description" content="${description}">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Source+Code+Pro:wght@400;500;600&family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>${css(t)}</style>
</head>
<body>
<div class="wrap">
  <header class="site">
    <div class="brand-row">
      ${logoImg}
      <div class="brand" ${attr("businessName")}>${esc(spec.businessName)}</div>
    </div>
    <nav class="site">${navLinks(ctx)}</nav>
  </header>
</div>

${body}

<footer class="site">
  <div class="brand">${esc(spec.businessName)}</div>
  <div ${attr("footerNote")}>${esc(spec.footerNote)}</div>
</footer>
${contactScript ? contactScriptTag(ctx) : ""}
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Styles                                                               */
/* ------------------------------------------------------------------ */

function css(t) {
  return `
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
.page-pad { padding-top: 1rem; }

header.site {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.5rem 0;
}
.brand-row { display: flex; align-items: center; gap: 0.9rem; }
.brand-row .logo { height: 2.5rem; width: auto; border-radius: 0.5rem; }
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
  margin: 0 auto 1rem;
}
.hero .ornament { margin-bottom: 1.25rem; }
.hero p.sub {
  color: hsl(var(--muted-foreground));
  max-width: 40rem;
  margin: 0 auto 2.25rem;
  font-size: 1.125rem;
}
.hero-actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
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
.btn-outline {
  background: transparent;
  color: hsl(var(--primary));
  border: 1px solid hsl(var(--primary) / 0.5);
}

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
.prose p + p { margin-top: 1.25rem; }

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

.menu-list { max-width: 44rem; margin: 0 auto; }
.menu-item + .menu-item { margin-top: 1.4rem; }
.menu-line { display: flex; align-items: baseline; gap: 0.5rem; }
.menu-name { font-weight: 600; }
.menu-dots { flex: 1; border-bottom: 1px dotted hsl(var(--border)); }
.menu-price { font-family: var(--font-mono); font-weight: 600; }
.menu-desc { color: hsl(var(--muted-foreground)); font-size: 0.9rem; }

.team-card .team-role {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.7rem;
  color: hsl(var(--primary));
  margin-bottom: 0.6rem;
}

.gallery-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
}
.gallery-grid img {
  width: 100%;
  height: 14rem;
  object-fit: cover;
  border-radius: 28px;
  border: 1px solid hsl(var(--border) / 0.7);
}

.quote blockquote { font-style: italic; margin-bottom: 0.75rem; }
.quote figcaption { color: hsl(var(--muted-foreground)); font-size: 0.875rem; }

.faq-list { max-width: 44rem; margin: 0 auto; display: grid; gap: 0.9rem; }
.faq-item { border-radius: 0.75rem; padding: 1.1rem 1.4rem; }
.faq-item summary { cursor: pointer; font-weight: 600; }
.faq-item p { margin-top: 0.6rem; }

.service-area {
  text-align: center;
  color: hsl(var(--muted-foreground));
  margin: -1.5rem 0 2rem;
}
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

.contact-form {
  max-width: 32rem;
  margin: 2.5rem auto 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.contact-form h3 { text-align: center; margin-bottom: 0.5rem; }
.contact-form label { font-size: 0.85rem; font-weight: 600; margin-top: 0.5rem; }
.contact-form input, .contact-form textarea {
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  padding: 0.65rem 0.8rem;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  color: hsl(var(--foreground));
}
.contact-form input:focus, .contact-form textarea:focus {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 1px;
}
.contact-form .btn { border: none; cursor: pointer; font-family: var(--font-sans); align-self: center; margin-top: 0.75rem; }
.contact-form .form-note { text-align: center; font-size: 0.8rem; color: hsl(var(--muted-foreground)); }

footer.site {
  border-top: 1px solid hsl(var(--border));
  padding: 2.5rem 0 3rem;
  text-align: center;
  color: hsl(var(--muted-foreground));
  font-size: 0.85rem;
}
footer.site .brand { font-size: 1rem; margin-bottom: 0.75rem; }
`;
}

/* ------------------------------------------------------------------ */
/* Ancillary files                                                      */
/* ------------------------------------------------------------------ */

/**
 * SVG favicon: the business's initial as a serif monogram on a
 * theme-colored rounded tile.
 */
export function renderFavicon(spec, options = {}) {
  const theme = resolveTheme(options);
  const initial = esc((spec.businessName ?? "A").trim().charAt(0).toUpperCase() || "A");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="hsl(${theme.primary})"/>
  <text x="32" y="44" text-anchor="middle" font-family="Cinzel, Georgia, serif"
    font-size="34" fill="hsl(${theme.primaryForeground})">${initial}</text>
</svg>
`;
}

/** Deployment instructions bundled with exported sites. */
export function renderDeployGuide(spec) {
  const name = spec.businessName ?? "your business";
  return `# Deploying the ${name} website

This folder is a complete static website — no build step, no server code.
Any static hosting service will work. Two common free options:

## GitHub Pages

1. Create a new repository on GitHub and upload these files.
2. In the repository, open **Settings → Pages**.
3. Under "Build and deployment", choose **Deploy from a branch**,
   select the \`main\` branch and the \`/ (root)\` folder, then save.
4. Your site will be live at \`https://<username>.github.io/<repository>/\`
   within a few minutes.

## Netlify

1. Go to https://app.netlify.com/drop
2. Drag this entire folder onto the page.
3. Netlify publishes it immediately and gives you a URL you can customize.

## After deploying

- Edit \`sitemap.xml\` and replace \`https://your-domain.example\` with your
  real site URL.
- If you use a custom domain, configure it in your hosting provider's
  settings and update DNS with your registrar.
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
export function renderSitemap(options = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const pages = options.multiPage ? PAGE_FILES : ["index.html"];
  const urls = pages
    .map((p) => `  <url>
    <loc>https://your-domain.example/${p === "index.html" ? "" : p}</loc>
    <lastmod>${today}</lastmod>
  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Replace https://your-domain.example with your site's URL after deploying -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
