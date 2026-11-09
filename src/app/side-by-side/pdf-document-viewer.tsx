"use client";

import { useEffect, useRef, useState } from "react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  TextLayer,
} from "pdfjs-dist";
import { findPdfTextMatches } from "@/lib/side-by-side";

export interface PdfSearchMatch {
  pageNumber: number;
  itemIndexes: number[];
}

interface PdfDocumentViewerProps {
  fileUrl: string;
  pageNumber: number;
  searchQuery: string;
  activeSearchMatch: number;
  searchMatches: PdfSearchMatch[];
  onLoad: (pageCount: number) => void;
  onError: (message: string) => void;
  onSearchResults: (matches: PdfSearchMatch[]) => void;
}

type PdfRenderTask = ReturnType<PDFPageProxy["render"]>;

export function PdfDocumentViewer({
  fileUrl,
  pageNumber,
  searchQuery,
  activeSearchMatch,
  searchMatches,
  onLoad,
  onError,
  onSearchResults,
}: PdfDocumentViewerProps) {
  const [documentProxy, setDocumentProxy] = useState<PDFDocumentProxy | null>(null);
  const [containerWidth, setContainerWidth] = useState(720);
  const [pageWidth, setPageWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [textLayerReadyPage, setTextLayerReadyPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    async function loadDocument() {
      setLoading(true);
      setDocumentProxy(null);
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("Couldn't load this PDF. Please try opening it again.");

        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
        const data = new Uint8Array(await response.arrayBuffer());
        loadingTask = pdfjs.getDocument({ data });
        const loadedDocument = await loadingTask.promise;
        if (!active) {
          await loadingTask.destroy();
          return;
        }

        setDocumentProxy(loadedDocument);
        onLoad(loadedDocument.numPages);
      } catch (error) {
        if (active) {
          onError(error instanceof Error ? error.message : "Couldn't open this PDF.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDocument();
    return () => {
      active = false;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [fileUrl, onError, onLoad]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(Math.floor(width));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const pdfDocument = documentProxy;
    if (!pdfDocument) return;
    let active = true;
    let renderTask: PdfRenderTask | null = null;
    let textLayer: TextLayer | null = null;

    async function renderPage(pdfDocument: PDFDocumentProxy) {
      const canvas = canvasRef.current;
      const textLayerContainer = textLayerRef.current;
      if (!canvas || !textLayerContainer) return;

      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (!active) return;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = Math.min((containerWidth - 24) / unscaledViewport.width, 1.8);
        const viewport = page.getViewport({ scale: Math.max(scale, 0.4) });
        setPageWidth(Math.ceil(viewport.width));
        const pixelRatio = window.devicePixelRatio || 1;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("This browser couldn't prepare the PDF viewer.");

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        textLayerContainer.style.width = `${viewport.width}px`;
        textLayerContainer.style.height = `${viewport.height}px`;
        textLayerContainer.style.setProperty("--total-scale-factor", String(viewport.scale));
        textLayerContainer.replaceChildren();

        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        await renderTask.promise;
        if (!active) return;

        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        textLayer = new pdfjs.TextLayer({
          textContentSource: await page.getTextContent(),
          container: textLayerContainer,
          viewport,
        });
        await textLayer.render();
        if (active) setTextLayerReadyPage(pageNumber);
      } catch (error) {
        if (active && !(error instanceof Error && error.name === "RenderingCancelledException")) {
          onError(error instanceof Error ? error.message : "Couldn't render this PDF page.");
        }
      }
    }

    void renderPage(pdfDocument);
    return () => {
      active = false;
      renderTask?.cancel();
      if (textLayer) textLayer.cancel();
    };
  }, [containerWidth, documentProxy, onError, pageNumber]);

  useEffect(() => {
    const pdfDocument = documentProxy;
    if (!pdfDocument) return;
    let active = true;

    async function searchDocument(pdfDocument: PDFDocumentProxy) {
      const query = searchQuery.trim();
      if (!query) {
        onSearchResults([]);
        return;
      }

      const results: PdfSearchMatch[] = [];
      for (let pageIndex = 1; pageIndex <= pdfDocument.numPages; pageIndex += 1) {
        const page = await pdfDocument.getPage(pageIndex);
        const textContent = await page.getTextContent();
        const textItems: string[] = [];
        for (const item of textContent.items) {
          if ("str" in item && typeof item.str === "string") textItems.push(item.str);
        }
        for (const itemIndexes of findPdfTextMatches(textItems, query)) {
          results.push({ pageNumber: pageIndex, itemIndexes });
        }
      }
      if (active) onSearchResults(results);
    }

    void searchDocument(pdfDocument).catch((error: unknown) => {
      if (active) onError(error instanceof Error ? error.message : "Couldn't search this PDF.");
    });

    return () => {
      active = false;
    };
  }, [documentProxy, onError, onSearchResults, searchQuery]);

  useEffect(() => {
    const textLayer = textLayerRef.current;
    if (!textLayer) return;

    const spans = Array.from(textLayer.querySelectorAll("span"));
    spans.forEach((span) => span.classList.remove("sbs-pdf-search-hit", "sbs-pdf-search-active"));
    if (!searchQuery.trim()) return;

    const currentMatch = searchMatches[activeSearchMatch];
    searchMatches.forEach((match, matchIndex) => {
      if (match.pageNumber !== pageNumber) return;
      for (const itemIndex of match.itemIndexes) {
        const span = spans[itemIndex];
        if (!span) continue;
        span.classList.add("sbs-pdf-search-hit");
        if (matchIndex === activeSearchMatch) span.classList.add("sbs-pdf-search-active");
      }
    });
    if (currentMatch?.pageNumber === pageNumber) {
      const activeSpan = spans[currentMatch.itemIndexes[0]];
      activeSpan?.scrollIntoView({ block: "center", inline: "nearest" });
    }
  }, [activeSearchMatch, pageNumber, searchMatches, searchQuery, textLayerReadyPage]);

  return (
    <div className="sbs-pdf-stage" ref={containerRef}>
      {loading && <p className="sbs-reader-status">Opening PDF…</p>}
      <div className="sbs-pdf-sheet" style={pageWidth ? { width: pageWidth } : undefined}>
        <div className="sbs-pdf-page" aria-label={`PDF page ${pageNumber}`}>
          <canvas ref={canvasRef} className="sbs-pdf-canvas" />
          <div ref={textLayerRef} className="sbs-pdf-text-layer" />
        </div>
        <footer className="sbs-pdf-page-number">Page {pageNumber}</footer>
      </div>
    </div>
  );
}
