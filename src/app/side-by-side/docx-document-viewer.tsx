"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { paginateMeasuredDocxParagraphs } from "@/lib/side-by-side";
import type { SideBySideHighlightRect } from "@/lib/side-by-side";

interface DocxDocumentViewerProps {
  documentId: number;
  originalName: string;
  text: string;
  searchQuery: string;
  activeSearchMatch: number;
  initialScrollTop: number;
  onScroll: (scrollTop: number) => void;
  onSearchMatchCount: (count: number) => void;
  highlights: Array<{ id: number; rects: SideBySideHighlightRect[] }>;
}

interface TextMatch {
  start: number;
  end: number;
  index: number;
}

function getParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function getOuterHeight(element: HTMLElement | null | undefined): number {
  if (!element) return 0;
  const style = getComputedStyle(element);
  return (
    element.getBoundingClientRect().height +
    Number.parseFloat(style.marginTop) +
    Number.parseFloat(style.marginBottom)
  );
}

function findTextMatches(text: string, query: string): Array<{ start: number; end: number }> {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];
  const normalizedText = text.toLocaleLowerCase();
  const matches: Array<{ start: number; end: number }> = [];
  let offset = 0;
  while (offset <= normalizedText.length - normalizedQuery.length) {
    const start = normalizedText.indexOf(normalizedQuery, offset);
    if (start < 0) break;
    matches.push({ start, end: start + normalizedQuery.length });
    offset = start + Math.max(1, normalizedQuery.length);
  }
  return matches;
}

export function DocxDocumentViewer({
  documentId,
  originalName,
  text,
  searchQuery,
  activeSearchMatch,
  initialScrollTop,
  onScroll,
  onSearchMatchCount,
  highlights,
}: DocxDocumentViewerProps) {
  const paragraphs = useMemo(() => getParagraphs(text), [text]);
  const [pages, setPages] = useState<string[][]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const pageMatches = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const localMatches = pages.map((page) =>
      page.map((paragraph) => findTextMatches(paragraph, query))
    );
    const pageOffsets = localMatches.map((_, pageIndex) =>
      localMatches.slice(0, pageIndex).flat(2).length
    );
    return localMatches.map((page, pageIndex) =>
      page.map((matches, paragraphIndex) => {
        const paragraphOffset =
          pageOffsets[pageIndex] + page.slice(0, paragraphIndex).flat().length;
        return matches.map((match, matchIndex) => ({
          ...match,
          index: paragraphOffset + matchIndex,
        }));
      })
    );
  }, [pages, searchQuery]);
  const searchMatchCount = pageMatches.flat(2).length;
  const scrollRef = useRef<HTMLDivElement>(null);
  const measurePageRef = useRef<HTMLElement>(null);
  const restoredDocumentRef = useRef<number | null>(null);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const observer = new ResizeObserver(() => {
      setContainerWidth(scroll.clientWidth);
    });
    observer.observe(scroll);
    setContainerWidth(scroll.clientWidth);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const measurePage = measurePageRef.current;
    const body = measurePage?.querySelector<HTMLElement>(".sbs-docx-page-body");
    const footer = measurePage?.querySelector<HTMLElement>(".sbs-docx-page-number");
    const heading = measurePage?.querySelector<HTMLElement>("h2");
    if (!scroll || !containerWidth || !measurePage || !body || !footer) return;

    const scrollStyle = getComputedStyle(scroll);
    const scrollContentWidth =
      scroll.clientWidth -
      Number.parseFloat(scrollStyle.paddingLeft) -
      Number.parseFloat(scrollStyle.paddingRight);
    measurePage.style.width = `${Math.min(scrollContentWidth, 780)}px`;
    const pageStyle = getComputedStyle(measurePage);
    const contentWidth = body.getBoundingClientRect().width;
    if (contentWidth <= 0) return;

    const pageHeight = measurePage.clientHeight;
    const pagePadding =
      Number.parseFloat(pageStyle.paddingTop) + Number.parseFloat(pageStyle.paddingBottom);
    const footerHeight = getOuterHeight(footer);
    const headingHeight = getOuterHeight(heading);
    const firstPageCapacity = pageHeight - pagePadding - footerHeight - headingHeight;
    const followingPageCapacity = pageHeight - pagePadding - footerHeight;
    if (firstPageCapacity <= 0 || followingPageCapacity <= 0) return;

    const measurement = document.createElement("div");
    measurement.className = "sbs-docx-measurement";
    measurement.style.width = `${contentWidth}px`;
    measurePage.append(measurement);

    const measureParagraph = (value: string): number => {
      const paragraph = document.createElement("p");
      paragraph.className = "sbs-docx-page-text";
      paragraph.textContent = value;
      measurement.replaceChildren(paragraph);
      return getOuterHeight(paragraph);
    };

    const nextPages = paginateMeasuredDocxParagraphs(
      paragraphs,
      measureParagraph,
      firstPageCapacity,
      followingPageCapacity
    );
    measurement.remove();
    setPages(nextPages);
  }, [containerWidth, documentId, originalName, paragraphs]);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || !pages.length || restoredDocumentRef.current === documentId) return;
    scroll.scrollTop = initialScrollTop;
    restoredDocumentRef.current = documentId;
  }, [documentId, initialScrollTop, pages.length]);

  useEffect(() => {
    onSearchMatchCount(searchMatchCount);
  }, [onSearchMatchCount, searchMatchCount]);

  useEffect(() => {
    if (activeSearchMatch < 0 || !searchQuery.trim()) return;
    scrollRef.current
      ?.querySelector<HTMLElement>(`[data-search-match-index="${activeSearchMatch}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeSearchMatch, pages, searchQuery]);

  const renderParagraph = (paragraph: string, matches: TextMatch[]) => {
    if (!matches.length) return paragraph;
    const parts = [];
    let cursor = 0;
    for (const match of matches) {
      if (match.start > cursor) parts.push(paragraph.slice(cursor, match.start));
      parts.push(
        <mark
          className={match.index === activeSearchMatch ? "sbs-search-match sbs-search-match-active" : "sbs-search-match"}
          data-search-match-index={match.index}
          key={match.index}
        >
          {paragraph.slice(match.start, match.end)}
        </mark>
      );
      cursor = match.end;
    }
    if (cursor < paragraph.length) parts.push(paragraph.slice(cursor));
    return parts;
  };
  return (
    <div
      ref={scrollRef}
      className="sbs-docx-scroll"
      onScroll={(event) => onScroll(Math.round(event.currentTarget.scrollTop))}
      tabIndex={0}
      aria-label="Word document text"
    >
      {pages.map((page, index) => (
        <article
          className="sbs-docx-page"
          data-sbs-page={index + 1}
          key={`${documentId}-${index}`}
        >
          {highlights.flatMap((highlight) =>
            highlight.rects
              .filter((rect) => rect.pageNumber === index + 1)
              .map((rect, rectIndex) => (
                <span
                  aria-hidden
                  className="sbs-saved-highlight"
                  key={`${highlight.id}-${rectIndex}`}
                  style={{
                    left: `${rect.x * 100}%`,
                    top: `${rect.y * 100}%`,
                    width: `${rect.width * 100}%`,
                    height: `${rect.height * 100}%`,
                  }}
                />
              ))
          )}
          {index === 0 && <h2>{originalName}</h2>}
          <div className="sbs-docx-page-body">
            {page.map((paragraph, paragraphIndex) => (
              <p className="sbs-docx-page-text" key={`${index}-${paragraphIndex}`}>
                {renderParagraph(paragraph, pageMatches[index]?.[paragraphIndex] ?? [])}
              </p>
            ))}
          </div>
          <footer className="sbs-docx-page-number">Page {index + 1}</footer>
        </article>
      ))}
      <article
        ref={measurePageRef}
        className="sbs-docx-page sbs-docx-measure-page"
        aria-hidden="true"
      >
        <h2>{originalName}</h2>
        <div className="sbs-docx-page-body" />
        <footer className="sbs-docx-page-number">Page</footer>
      </article>
    </div>
  );
}
