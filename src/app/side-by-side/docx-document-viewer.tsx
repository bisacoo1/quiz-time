"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { paginateMeasuredDocxParagraphs } from "@/lib/side-by-side";

interface DocxDocumentViewerProps {
  documentId: number;
  originalName: string;
  text: string;
  initialScrollTop: number;
  onScroll: (scrollTop: number) => void;
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

export function DocxDocumentViewer({
  documentId,
  originalName,
  text,
  initialScrollTop,
  onScroll,
}: DocxDocumentViewerProps) {
  const paragraphs = useMemo(() => getParagraphs(text), [text]);
  const [pages, setPages] = useState<string[][]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
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

  return (
    <div
      ref={scrollRef}
      className="sbs-docx-scroll"
      onScroll={(event) => onScroll(Math.round(event.currentTarget.scrollTop))}
      tabIndex={0}
      aria-label="Word document text"
    >
      {pages.map((page, index) => (
        <article className="sbs-docx-page" key={`${documentId}-${index}`}>
          {index === 0 && <h2>{originalName}</h2>}
          <div className="sbs-docx-page-body">
            {page.map((paragraph, paragraphIndex) => (
              <p className="sbs-docx-page-text" key={paragraphIndex}>{paragraph}</p>
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
