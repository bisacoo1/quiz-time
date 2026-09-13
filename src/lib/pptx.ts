import JSZip from "jszip";

/**
 * Gemini can't read .pptx binaries directly, so PowerPoint files are converted
 * to plain text on the server and sent as a text part instead of inline data.
 */
const MAX_PPTX_CHARS = 100_000;

const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const PPT_MIME = "application/vnd.ms-powerpoint";
// .ppsx is a PowerPoint slideshow — same OOXML zip structure as .pptx
const PPSX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow";

export function isPptxFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type === PPTX_MIME || type === PPT_MIME || type === PPSX_MIME) return true;
  return /\.pptx?$/i.test(file.name || "");
}

/** Decode the small set of XML entities that appear inside <a:t> runs. */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

/** Pull readable text out of a .pptx file (OOXML zip). */
export async function extractPptxText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error(
      `Couldn't read "${file.name || "that PowerPoint file"}". If it's an old .ppt file, re-save it as .pptx (or export it to PDF) and try again.`
    );
  }

  // ppt/slides/slide1.xml, slide2.xml, ... — numeric sort
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml$/i)?.[1] ?? "0", 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml$/i)?.[1] ?? "0", 10);
      return na - nb;
    });

  if (slidePaths.length === 0) {
    throw new Error(
      `Couldn't find any slides in "${file.name || "that PowerPoint file"}". If it's an old .ppt file, re-save it as .pptx (or export it to PDF) and try again.`
    );
  }

  const slidesText: string[] = [];

  for (let i = 0; i < slidePaths.length; i++) {
    const path = slidePaths[i];
    const xml = await zip.file(path)!.async("string");

    // Each <a:t> is a run of text. Join runs with spaces; preserve paragraphs
    // loosely by letting the regex collect all runs in document order.
    const runs: string[] = [];
    const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      const decoded = decodeXmlEntities(m[1]);
      // Trim each run but keep internal spaces; empty runs are placeholders.
      if (decoded.trim()) runs.push(decoded);
    }

    const slideText = runs.join(" ").replace(/\s+/g, " ").trim();
    if (slideText) {
      slidesText.push(`--- Slide ${i + 1} ---\n${slideText}`);
    }
  }

  const text = slidesText
    .join("\n\n")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) {
    throw new Error("That PowerPoint file has no readable text in it.");
  }

  return text.length > MAX_PPTX_CHARS
    ? `${text.slice(0, MAX_PPTX_CHARS)}\n\n[truncated]`
    : text;
}
