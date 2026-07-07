import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-6";

export const SITE_SPEC_SCHEMA = {
  type: "object",
  properties: {
    businessName: { type: "string" },
    tagline: { type: "string", description: "Short uppercase-friendly tagline, 3-7 words" },
    industry: { type: "string" },
    hero: {
      type: "object",
      properties: {
        headline: { type: "string" },
        subheadline: { type: "string" },
        cta: { type: "string", description: "Call-to-action button label" }
      },
      required: ["headline", "subheadline", "cta"],
      additionalProperties: false
    },
    about: {
      type: "object",
      properties: {
        heading: { type: "string" },
        body: { type: "string", description: "2-3 paragraphs separated by \\n\\n" }
      },
      required: ["heading", "body"],
      additionalProperties: false
    },
    services: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" }
        },
        required: ["name", "description"],
        additionalProperties: false
      }
    },
    testimonials: {
      type: "array",
      items: {
        type: "object",
        properties: {
          quote: { type: "string" },
          author: { type: "string" }
        },
        required: ["quote", "author"],
        additionalProperties: false
      }
    },
    faq: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          answer: { type: "string" }
        },
        required: ["question", "answer"],
        additionalProperties: false
      }
    },
    contact: {
      type: "object",
      properties: {
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "string" },
        hours: { type: "string" }
      },
      required: ["email", "phone", "address", "hours"],
      additionalProperties: false
    },
    footerNote: { type: "string" }
  },
  required: [
    "businessName", "tagline", "industry", "hero", "about",
    "services", "testimonials", "faq", "contact", "footerNote"
  ],
  additionalProperties: false
};

const SYSTEM_PROMPT = `You are a professional website copywriter for small businesses.
Given a description of a business (and optionally imported documents), produce
content for a polished single-page website.

Tone of voice:
- Professional: quiet authority, no hype, no urgency tactics.
- Clear: explain things simply, no unnecessary jargon.
- Empowering: speak directly to the reader using "you" and "your".
- Long-term: frame value in terms of lasting benefit, not quick wins.
- Never use sales pressure language ("Act now!", "Limited time!").
- Never make guarantees or use superlatives without evidence.

Rules:
- Use only facts present in the input. If contact details are missing, use
  sensible placeholders like "hello@example.com" or "(555) 555-0100".
- Write 3-6 services, 2-3 testimonials (invent plausible ones only if none
  are provided, keeping them modest and realistic), and 3-5 FAQ entries.
- The tagline should be short and dignified (3-7 words), suitable for
  uppercase letter-spaced display.`;

/**
 * Generate a site spec from a business description + optional imported document text.
 * Uses the Claude API when ANTHROPIC_API_KEY is set; otherwise falls back to demo mode.
 */
export async function generateSiteSpec(description, documentText = "") {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { spec: demoSpec(description, documentText), mode: "demo" };
  }

  const client = new Anthropic();
  const userContent = documentText
    ? `Business description:\n${description}\n\nImported documents:\n${documentText}`
    : `Business description:\n${description}`;

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8192,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
      output_config: { format: { type: "json_schema", schema: SITE_SPEC_SCHEMA } }
    });

    const message = await stream.finalMessage();
    const text = message.content.find((b) => b.type === "text")?.text;
    if (!text) throw new Error("Model returned no text content");
    return { spec: JSON.parse(text), mode: "api" };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.warn("ANTHROPIC_API_KEY is invalid — falling back to demo mode.");
      return { spec: demoSpec(description, documentText), mode: "demo" };
    }
    throw err;
  }
}

/**
 * Deterministic fallback used when no API key is configured, so the full
 * pipeline (import -> spec -> render -> preview -> download) can be exercised.
 */
export function demoSpec(description, documentText = "") {
  // Strip the "--- filename ---" headers importers add, then use document
  // text as the source when no description was typed.
  const docBody = documentText.replace(/^--- .+ ---$/gm, "").trim();
  if (!description.trim() && docBody) {
    description = docBody.slice(0, 600);
  }
  const firstSentence = description.split(/[.!?\n]/)[0].trim();
  const words = firstSentence.split(/\s+/).filter(Boolean);
  const guessedName = words.slice(0, 3).map(capitalize).join(" ") || "Your Business";

  return {
    businessName: guessedName,
    tagline: "Quality You Can Rely On",
    industry: "Small Business",
    hero: {
      headline: firstSentence || "Welcome",
      subheadline:
        "We take pride in doing careful, honest work for our community — and we would be glad to do the same for you.",
      cta: "Get in Touch"
    },
    about: {
      heading: "About Us",
      body:
        `${description.trim()}\n\nWe believe in doing things right the first time. ` +
        "Every client relationship is built on clarity, fair pricing, and work that stands the test of time."
    },
    services: [
      { name: "Consultation", description: "A clear, no-pressure conversation about what you need and how we can help." },
      { name: "Core Services", description: "Careful, professional work tailored to your situation." },
      { name: "Ongoing Support", description: "We remain available after the job is done, because lasting value matters." }
    ],
    testimonials: [
      { quote: "Straightforward, honest, and thorough. Exactly what we hoped for.", author: "A local client" },
      { quote: "They explained everything clearly and delivered on time.", author: "A returning customer" }
    ],
    faq: [
      { question: "How do I get started?", answer: "Reach out by phone or email and we will schedule a brief conversation about your needs." },
      { question: "What areas do you serve?", answer: "We serve our local community and surrounding areas. Contact us to confirm availability." },
      { question: "How is pricing determined?", answer: "We provide clear, upfront estimates before any work begins — no hidden fees." }
    ],
    contact: {
      email: "hello@example.com",
      phone: "(555) 555-0100",
      address: "123 Main Street",
      hours: "Mon–Fri, 9am–5pm"
    },
    footerNote: `© ${new Date().getFullYear()} ${guessedName}. All rights reserved.`
  };
}

function capitalize(w) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}
