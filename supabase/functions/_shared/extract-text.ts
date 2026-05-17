// supabase/functions/_shared/extract-text.ts
// Server-side document text extraction for the AI wizard (AI-SPEC §4 "Tool Use").
//
// PDF  — `unpdf` bundles a serverless build of pdf.js with no DOM dependency, which
//        is what makes it Deno/Edge-Function safe (stock pdfjs-dist / pdf-parse assume
//        Node/browser globals and fail in Deno).
// DOCX — a .docx is a ZIP archive. Unzip with `unzipit`, read `word/document.xml`, and
//        strip XML tags to recover paragraph text. (mammoth pulls in Node Buffer/stream
//        deps that do not run cleanly on Deno.)
//
// Both run INSIDE the Edge Function (project constraint #4). The plan-aware raw-byte
// size limit (Free 1 MB / Pro 5 MB) is enforced BEFORE extraction (threat T-03-05);
// recovered text is capped at 12000 characters with a `truncated` flag (AI-SPEC §4b
// "Context Window Management").

import { extractText, getDocumentProxy } from 'npm:unpdf@0.12.1'
import { unzip } from 'npm:unzipit@1.4.3'

export const MAX_SOURCE_CHARS = 12_000

export interface ExtractedDocument {
  text: string
  truncated: boolean
}

/** Decode a base64 string to a byte array. */
function base64ToBytes(b64: string): Uint8Array {
  // Strip a possible `data:...;base64,` prefix.
  const clean = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Cap recovered text at MAX_SOURCE_CHARS, preferring a paragraph boundary. */
function capText(raw: string): ExtractedDocument {
  const text = raw.trim()
  if (text.length <= MAX_SOURCE_CHARS) return { text, truncated: false }
  const slice = text.slice(0, MAX_SOURCE_CHARS)
  const lastBreak = slice.lastIndexOf('\n')
  const cut = lastBreak > MAX_SOURCE_CHARS * 0.5 ? slice.slice(0, lastBreak) : slice
  return { text: cut, truncated: true }
}

function isPdf(fileName: string): boolean {
  return /\.pdf$/i.test(fileName)
}

function isDocx(fileName: string): boolean {
  return /\.docx$/i.test(fileName)
}

/**
 * Decode the HTML/XML entities that can appear in a DOCX `word/document.xml`.
 * WR-04: the named-entity set was incomplete — numeric (`&#1090;`) and hex
 * (`&#x0442;`) entities are common in Cyrillic DOCX and previously leaked into
 * the prompt verbatim. Decode all four forms. `&amp;` is decoded LAST so a
 * decoded `&` cannot be re-interpreted as the start of another entity.
 */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Extract text from a DOCX ZIP container by reading word/document.xml. */
async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const { entries } = await unzip(bytes.buffer as ArrayBuffer)
  const docEntry = entries['word/document.xml']
  if (!docEntry) throw new Error('DOCX: word/document.xml not found')
  const xml = await docEntry.text()
  // WR-04: strip XML comments and CDATA sections BEFORE the generic tag strip.
  // `<[^>]+>` stops at the first `>`, so a comment body or a CDATA payload
  // (and any literal `>` inside them) would otherwise leak into the text.
  const stripped = xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
  // Paragraph and break tags become newlines; all other tags are stripped.
  const text = stripped
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeXmlEntities(text)
}

/** Extract text from a PDF using the serverless pdf.js build in unpdf. */
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes)
  const { text } = await extractText(pdf, { mergePages: true })
  return Array.isArray(text) ? text.join('\n') : text
}

/**
 * Decode `fileBase64`, validate its raw byte length against `maxBytes` (the plan-aware
 * limit), extract plain text from a PDF or DOCX, and cap the result at 12000 chars.
 *
 * @param fileBase64 base64-encoded file content
 * @param fileName   used only to detect the file type (.pdf / .docx)
 * @param maxBytes   plan-aware raw-byte size limit (Free 1 MB / Pro 5 MB)
 * @throws if the file type is unsupported or the raw size exceeds `maxBytes`
 */
export async function extractDocumentText(
  fileBase64: string,
  fileName: string,
  maxBytes: number,
): Promise<ExtractedDocument> {
  const bytes = base64ToBytes(fileBase64)

  // Server-side size guard BEFORE extraction (threat T-03-05).
  if (bytes.byteLength > maxBytes) {
    throw new Error(
      `FILE_TOO_LARGE: ${bytes.byteLength} bytes exceeds the plan limit of ${maxBytes}`,
    )
  }

  let raw: string
  if (isPdf(fileName)) {
    raw = await extractPdfText(bytes)
  } else if (isDocx(fileName)) {
    raw = await extractDocxText(bytes)
  } else {
    throw new Error(`UNSUPPORTED_FILE_TYPE: only PDF and DOCX are supported (${fileName})`)
  }

  return capText(raw)
}
