import mammoth from "mammoth";

/**
 * Gemini can't read .docx binaries directly, so Word files are converted to
 * plain text on the server and sent as a text part instead of inline data.
 */
const MAX_DOCX_CHARS = 100_000;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isDocxFile(file: File): boolean {
  return (
    file.type === DOCX_MIME ||
    file.type === "application/msword" ||
    /\.docx?$/i.test(file.name || "")
  );
}

/** Pull the readable text out of a .docx file. */
export async function extractDocxText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const { value } = await mammoth.extractRawText({ buffer });

  const text = (value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) {
    throw new Error("That Word file has no readable text in it.");
  }

  return text.length > MAX_DOCX_CHARS
    ? `${text.slice(0, MAX_DOCX_CHARS)}\n\n[truncated]`
    : text;
}
