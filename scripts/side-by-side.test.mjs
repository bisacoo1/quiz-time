import test from "node:test";
import assert from "node:assert/strict";
import {
  hasSideBySideStorageCapacity,
  findPdfTextMatches,
  getSideBySideMimeType,
  isSideBySideMimeType,
  paginateMeasuredDocxParagraphs,
  removeTutorMarkdown,
  sanitizeDocumentName,
  SIDE_BY_SIDE_MAX_FILE_BYTES,
  SIDE_BY_SIDE_STORAGE_LIMIT_BYTES,
} from "../src/lib/side-by-side.ts";

test("Side by Side accepts PDF and DOCX extensions case-insensitively", () => {
  assert.equal(getSideBySideMimeType("notes.pdf"), "application/pdf");
  assert.equal(
    getSideBySideMimeType("Lecture.DOCX"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  assert.equal(getSideBySideMimeType("legacy.doc"), null);
  assert.equal(getSideBySideMimeType("notes.txt"), null);
});

test("document names are safe for display and storage metadata", () => {
  assert.equal(sanitizeDocumentName("  unit/one\\notes.pdf  "), "unit_one_notes.pdf");
  assert.equal(sanitizeDocumentName("week\u0000\u001f1.docx"), "week1.docx");
  assert.equal(sanitizeDocumentName("a".repeat(300)).length, 255);
  assert.equal(sanitizeDocumentName(" \u0000 "), "");
});

test("only supported document MIME types pass validation", () => {
  assert.equal(isSideBySideMimeType("application/pdf"), true);
  assert.equal(
    isSideBySideMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    true
  );
  assert.equal(isSideBySideMimeType("application/msword"), false);
});

test("storage reservations include pending uploads and allow exactly the account limit", () => {
  assert.equal(
    hasSideBySideStorageCapacity(
      SIDE_BY_SIDE_STORAGE_LIMIT_BYTES - SIDE_BY_SIDE_MAX_FILE_BYTES,
      0,
      SIDE_BY_SIDE_MAX_FILE_BYTES
    ),
    true
  );
  assert.equal(
    hasSideBySideStorageCapacity(
      SIDE_BY_SIDE_STORAGE_LIMIT_BYTES - SIDE_BY_SIDE_MAX_FILE_BYTES,
      1,
      SIDE_BY_SIDE_MAX_FILE_BYTES
    ),
    false
  );
  assert.equal(
    hasSideBySideStorageCapacity(
      SIDE_BY_SIDE_STORAGE_LIMIT_BYTES - SIDE_BY_SIDE_MAX_FILE_BYTES - 1,
      1,
      SIDE_BY_SIDE_MAX_FILE_BYTES
    ),
    true
  );
});

test("storage reservations reject invalid byte counts", () => {
  assert.equal(hasSideBySideStorageCapacity(-1, 0, 1), false);
  assert.equal(hasSideBySideStorageCapacity(0, 0, 0), false);
  assert.equal(hasSideBySideStorageCapacity(0, 0, 1.5), false);
});

test("tutor answers display cleanly without Markdown markers", () => {
  const input = [
    "### What the Passage Means",
    "The **CECS Fee Tracker** is a *computer program*.",
    "",
    "* **Purpose:** Tracks fees.",
    "* **Technology:** Uses `Python`.",
    "---",
    "[Read more](https://example.com)",
  ].join("\n");
  assert.equal(
    removeTutorMarkdown(input),
    "What the Passage Means\nThe CECS Fee Tracker is a computer program.\n\nPurpose: Tracks fees.\nTechnology: Uses Python.\n\nRead more"
  );
});

test("PDF text search finds case-insensitive matches across text spans", () => {
  assert.deepEqual(findPdfTextMatches(["The", "study", "guide", "study guide"], "study guide"), [
    [1, 2],
    [3],
  ]);
  assert.deepEqual(findPdfTextMatches(["Nothing matches"], "missing"), []);
  assert.deepEqual(findPdfTextMatches(["A word"], "  WORD "), [[0]]);
});

test("DOCX pagination uses measured paragraph heights and preserves text", () => {
  const paragraphs = ["First paragraph with several words.", "Another paragraph."];
  const pages = paginateMeasuredDocxParagraphs(
    paragraphs,
    (value) => Math.ceil(value.length / 12) * 12,
    24,
    36
  );
  assert.ok(pages.length > 1);
  assert.equal(pages.flat().join(""), paragraphs.join(""));
  assert.ok(pages.every((page) => page.length > 0));
});

test("DOCX pagination splits a paragraph at measured word boundaries", () => {
  const text = "one two three four five six seven eight";
  const pages = paginateMeasuredDocxParagraphs(
    [text],
    (value) => Math.ceil(value.length / 8) * 8,
    16,
    16
  );
  assert.ok(pages.length > 1);
  assert.equal(pages.flat().join(""), text);
  assert.ok(pages.every((page) => page.length === 1));
});
