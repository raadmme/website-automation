#!/usr/bin/env node
/**
 * Headless website generation.
 *
 * Usage:
 *   node cli.js "A family-run bakery in Asheville..." [options]
 *   node cli.js --file notes.txt --file brochure.pdf [options]
 *
 * Options:
 *   --file <path>   Import a document (txt, md, csv, pdf, docx). Repeatable.
 *   --theme <name>  warm (default) | forest | slate | wine
 *   --out <dir>     Output directory (default: ./site)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { generateSiteSpec } from "./lib/generator.js";
import { THEMES } from "./lib/renderer.js";
import { writeSiteFiles } from "./lib/site.js";
import { extractText } from "./lib/importers.js";

function parseArgs(argv) {
  const args = { files: [], theme: "warm", out: "./site", description: "" };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--file": args.files.push(argv[++i]); break;
      case "--theme": args.theme = argv[++i]; break;
      case "--out": args.out = argv[++i]; break;
      case "--help": case "-h": args.help = true; break;
      default: args.description += (args.description ? " " : "") + argv[i];
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (args.help || (!args.description && !args.files.length)) {
  console.log(`Usage: node cli.js "<business description>" [--file <doc>]... [--theme warm|forest|slate|wine] [--out <dir>]`);
  process.exit(args.help ? 0 : 1);
}

if (!THEMES[args.theme]) {
  console.error(`Unknown theme "${args.theme}". Available: ${Object.keys(THEMES).join(", ")}`);
  process.exit(1);
}

const docTexts = [];
for (const file of args.files) {
  const buffer = await fs.readFile(file);
  const text = await extractText(path.basename(file), buffer);
  docTexts.push(`--- ${path.basename(file)} ---\n${text}`);
}

console.log(process.env.ANTHROPIC_API_KEY
  ? "Generating website content with Claude…"
  : "No ANTHROPIC_API_KEY set — generating in demo mode.");

const { spec, mode } = await generateSiteSpec(args.description, docTexts.join("\n\n"));
const outDir = path.resolve(args.out);
await writeSiteFiles(outDir, spec, { theme: args.theme });

console.log(`Done (${mode} mode). Website for "${spec.businessName}" written to ${outDir}`);
console.log("Open index.html in a browser, or see DEPLOY.md for hosting instructions.");
