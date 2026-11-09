export const SIDE_BY_SIDE_MAX_FILE_BYTES = 50 * 1024 * 1024;
export const SIDE_BY_SIDE_STORAGE_LIMIT_BYTES = 500 * 1024 * 1024;
export function hasSideBySideStorageCapacity(
  usedBytes: number,
  reservedBytes: number,
  requestedBytes: number
): boolean {
  return (
    Number.isSafeInteger(usedBytes) &&
    usedBytes >= 0 &&
    Number.isSafeInteger(reservedBytes) &&
    reservedBytes >= 0 &&
    Number.isSafeInteger(requestedBytes) &&
    requestedBytes > 0 &&
    usedBytes + reservedBytes + requestedBytes <= SIDE_BY_SIDE_STORAGE_LIMIT_BYTES
  );
}

export const SIDE_BY_SIDE_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type SideBySideMimeType = (typeof SIDE_BY_SIDE_ALLOWED_MIME_TYPES)[number];

export function sanitizeDocumentName(name: string): string {
  return name
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255);
}

export function getSideBySideMimeType(name: string): SideBySideMimeType | null {
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return null;
}

export function isSideBySideMimeType(value: string): value is SideBySideMimeType {
  return SIDE_BY_SIDE_ALLOWED_MIME_TYPES.includes(value as SideBySideMimeType);
}

export function removeTutorMarkdown(text: string): string {
  return text
    .replace(/```[\w-]*\s*\n?/g, "")
    .replace(/```/g, "")
    .replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, "")
    .replace(/^[ \t]*(?:(?:\*{3,}|-{3,}|_{3,})[ \t]*)$/gm, "")
    .replace(/^[ \t]*(?:[-*+]|\d+[.)])[ \t]+/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)([^*_]+)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function paginateMeasuredDocxParagraphs(
  paragraphs: string[],
  measureHeight: (text: string) => number,
  firstPageCapacity: number,
  followingPageCapacity: number
): string[][] {
  if (firstPageCapacity <= 0 || followingPageCapacity <= 0) return [];

  const pages: string[][] = [];
  let currentPage: string[] = [];
  let currentHeight = 0;
  let pageCapacity = firstPageCapacity;
  const finishPage = () => {
    if (currentPage.length) pages.push(currentPage);
    currentPage = [];
    currentHeight = 0;
    pageCapacity = followingPageCapacity;
  };

  const splitParagraph = (value: string, capacity: number): string[] => {
    const words = value.match(/\S+\s*/g) ?? [value];
    const chunks: string[] = [];
    let wordStart = 0;

    while (wordStart < words.length) {
      let low = wordStart + 1;
      let high = words.length;
      let best = wordStart;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = words.slice(wordStart, middle).join("");
        if (measureHeight(candidate) <= capacity) {
          best = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }

      if (best === wordStart) {
        const word = words[wordStart];
        let lowLength = 1;
        let highLength = word.length;
        let bestLength = 0;
        while (lowLength <= highLength) {
          const middle = Math.floor((lowLength + highLength) / 2);
          if (measureHeight(word.slice(0, middle)) <= capacity) {
            bestLength = middle;
            lowLength = middle + 1;
          } else {
            highLength = middle - 1;
          }
        }
        const safeLength = Math.max(1, bestLength);
        chunks.push(word.slice(0, safeLength));
        if (safeLength === word.length) {
          wordStart += 1;
        } else {
          words[wordStart] = word.slice(safeLength);
        }
      } else {
        chunks.push(words.slice(wordStart, best).join(""));
        wordStart = best;
      }
    }
    return chunks;
  };

  for (const paragraph of paragraphs) {
    let paragraphHeight = measureHeight(paragraph);
    if (currentHeight + paragraphHeight > pageCapacity && currentPage.length) finishPage();

    if (paragraphHeight <= pageCapacity - currentHeight) {
      currentPage.push(paragraph);
      currentHeight += paragraphHeight;
      continue;
    }

    const chunks = splitParagraph(paragraph, pageCapacity);
    for (const chunk of chunks) {
      paragraphHeight = measureHeight(chunk);
      if (currentHeight + paragraphHeight > pageCapacity && currentPage.length) finishPage();
      currentPage.push(chunk);
      currentHeight += paragraphHeight;
      if (currentHeight >= pageCapacity) finishPage();
    }
  }
  finishPage();
  return pages;
}
