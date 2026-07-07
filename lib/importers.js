import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const MAX_CHARS = 60_000; // keep imported text within a sane prompt size

/**
 * Extract plain text from an uploaded document buffer.
 * Supported: .txt, .md, .pdf, .docx
 */
export async function extractText(filename, buffer) {
  const ext = filename.toLowerCase().split(".").pop();

  let text;
  switch (ext) {
    case "txt":
    case "md":
    case "csv":
      text = buffer.toString("utf-8");
      break;
    case "pdf": {
      // pdf-parse is CommonJS; its index.js runs debug code when required as
      // a main module, so require the lib entry directly.
      const pdfParse = require("pdf-parse/lib/pdf-parse.js");
      const result = await pdfParse(buffer);
      text = result.text;
      break;
    }
    case "docx": {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
      break;
    }
    default:
      throw new Error(`Unsupported file type: .${ext} (supported: txt, md, csv, pdf, docx)`);
  }

  text = text.trim();
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + "\n\n[Document truncated]";
  }
  return text;
}
