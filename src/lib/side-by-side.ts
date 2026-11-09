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

const DOCX_PAGE_CHARACTER_LIMIT = 1600;

export function paginateDocxText(text: string): string[] {
  const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  const pages: string[] = [];
  let currentPage = "";

  const appendParagraph = (paragraph: string) => {
    const nextPage = currentPage ? `${currentPage}\n\n${paragraph}` : paragraph;
    if (nextPage.length <= DOCX_PAGE_CHARACTER_LIMIT) {
      currentPage = nextPage;
      return;
    }

    if (currentPage) {
      pages.push(currentPage);
      currentPage = "";
    }

    if (paragraph.length <= DOCX_PAGE_CHARACTER_LIMIT) {
      currentPage = paragraph;
      return;
    }

    const words = paragraph.match(/\S+\s*/g) ?? [];
    for (const word of words) {
      if (word.length > DOCX_PAGE_CHARACTER_LIMIT) {
        if (currentPage) {
          pages.push(currentPage);
          currentPage = "";
        }
        for (let offset = 0; offset < word.length; offset += DOCX_PAGE_CHARACTER_LIMIT) {
          const chunk = word.slice(offset, offset + DOCX_PAGE_CHARACTER_LIMIT);
          if (chunk.length === DOCX_PAGE_CHARACTER_LIMIT) pages.push(chunk);
          else currentPage = chunk;
        }
        continue;
      }

      const nextChunk = currentPage ? `${currentPage}${word}` : word;
      if (nextChunk.length > DOCX_PAGE_CHARACTER_LIMIT && currentPage) {
        pages.push(currentPage);
        currentPage = word;
      } else {
        currentPage = nextChunk;
      }
    }
  };

  for (const paragraph of paragraphs) {
    const normalized = paragraph.trim();
    if (normalized) appendParagraph(normalized);
  }
  if (currentPage) pages.push(currentPage);

  return pages;
}
