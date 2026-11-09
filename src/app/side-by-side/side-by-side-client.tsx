"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { upload } from "@vercel/blob/client";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Highlighter,
  LoaderCircle,
  MessageCircle,
  NotebookPen,
  Search,
  Save,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { PdfDocumentViewer, type PdfSearchMatch } from "./pdf-document-viewer";
import { DocxDocumentViewer } from "./docx-document-viewer";
import {
  getSideBySideMimeType,
  sanitizeDocumentName,
  SIDE_BY_SIDE_MAX_FILE_BYTES,
  SIDE_BY_SIDE_STORAGE_LIMIT_BYTES,
  SIDE_BY_SIDE_HIGHLIGHT_NOTE_MAX_LENGTH,
  isValidSideBySideHighlightRects,
  type SideBySideHighlightRect,
} from "@/lib/side-by-side";

interface SavedDocument {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  lastPage: number;
  lastScrollTop: number;
  createdAt: string;
  updatedAt: string;
}

interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

interface SavedHighlight {
  id: number;
  quote: string;
  note: string;
  rects: SideBySideHighlightRect[];
  createdAt: string;
  updatedAt: string;
}

function isSavedHighlight(value: unknown): value is SavedHighlight {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "id" in value &&
    Number.isSafeInteger(value.id) &&
    "quote" in value &&
    typeof value.quote === "string" &&
    "note" in value &&
    typeof value.note === "string" &&
    "rects" in value &&
    isValidSideBySideHighlightRects(value.rects) &&
    "createdAt" in value &&
    typeof value.createdAt === "string" &&
    "updatedAt" in value &&
    typeof value.updatedAt === "string"
  );
}

interface DocumentProgress {
  lastPage?: number;
  lastScrollTop?: number;
}

interface StorageUsage {
  usedBytes: number;
  reservedBytes: number;
  limitBytes: number;
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function formatSize(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(value)
  );
}

function errorFromResponse(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return fallback;
}

function getSelectionHighlightRects(
  range: Range,
  reader: HTMLElement | null
): SideBySideHighlightRect[] {
  if (!reader) return [];
  const pages = Array.from(reader.querySelectorAll<HTMLElement>("[data-sbs-page]"));
  const rects: SideBySideHighlightRect[] = [];

  for (const selectionRect of Array.from(range.getClientRects())) {
    const centerX = selectionRect.left + selectionRect.width / 2;
    const centerY = selectionRect.top + selectionRect.height / 2;
    const page = pages.find((candidate) => {
      const bounds = candidate.getBoundingClientRect();
      return (
        centerX >= bounds.left &&
        centerX <= bounds.right &&
        centerY >= bounds.top &&
        centerY <= bounds.bottom &&
        bounds.width > 0 &&
        bounds.height > 0
      );
    });
    if (!page) continue;

    const bounds = page.getBoundingClientRect();
    const left = Math.max(selectionRect.left, bounds.left);
    const top = Math.max(selectionRect.top, bounds.top);
    const right = Math.min(selectionRect.right, bounds.right);
    const bottom = Math.min(selectionRect.bottom, bounds.bottom);
    if (right <= left || bottom <= top) continue;
    rects.push({
      pageNumber: Number(page.dataset.sbsPage),
      x: (left - bounds.left) / bounds.width,
      y: (top - bounds.top) / bounds.height,
      width: (right - left) / bounds.width,
      height: (bottom - top) / bounds.height,
    });
  }
  return rects.filter((rect) => Number.isSafeInteger(rect.pageNumber) && rect.pageNumber > 0);
}

export default function SideBySideClient() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [storageUsage, setStorageUsage] = useState<StorageUsage>({
    usedBytes: 0,
    reservedBytes: 0,
    limitBytes: SIDE_BY_SIDE_STORAGE_LIMIT_BYTES,
  });
  const [activeDocument, setActiveDocument] = useState<SavedDocument | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busyDocumentId, setBusyDocumentId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [readerError, setReaderError] = useState("");
  const [loadedDocx, setLoadedDocx] = useState<{ documentId: number; text: string } | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const [pdfSearchMatches, setPdfSearchMatches] = useState<PdfSearchMatch[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [selectionContext, setSelectionContext] = useState("");
  const [selectionAction, setSelectionAction] = useState<{ left: number; top: number } | null>(null);
  const [selectionRects, setSelectionRects] = useState<SideBySideHighlightRect[]>([]);
  const [selectionExplained, setSelectionExplained] = useState(false);
  const [savedHighlights, setSavedHighlights] = useState<SavedHighlight[]>([]);
  const [highlightsDocumentId, setHighlightsDocumentId] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<"tutor" | "highlights">("tutor");
  const [highlightsError, setHighlightsError] = useState("");
  const [creatingHighlight, setCreatingHighlight] = useState(false);
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<number | null>(null);
  const [deletingHighlightId, setDeletingHighlightId] = useState<number | null>(null);
  const [pendingHighlightPage, setPendingHighlightPage] = useState<number | null>(null);
  const pendingHighlightPageRef = useRef<number | null>(null);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [conversationDocumentId, setConversationDocumentId] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [tutorBusy, setTutorBusy] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [tutorError, setTutorError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerContentRef = useRef<HTMLDivElement>(null);
  const aiPanelRef = useRef<HTMLElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeDocumentId = activeDocument?.id;
  const conversationLoading =
    !!activeDocumentId && activeDocumentId !== conversationDocumentId;
  const highlightsLoading =
    !!activeDocumentId && activeDocumentId !== highlightsDocumentId;
  const activeDocumentMimeType = activeDocument?.mimeType;
  const activeDocumentLastScrollTop = activeDocument?.lastScrollTop ?? 0;
  const docxText =
    loadedDocx && loadedDocx.documentId === activeDocumentId ? loadedDocx.text : "";
  const currentHighlights =
    activeDocumentId === highlightsDocumentId ? savedHighlights : [];
  const documentLoading =
    activeDocumentMimeType === DOCX_MIME &&
    loadedDocx?.documentId !== activeDocumentId &&
    !readerError;
  const loadingDocuments =
    status === "loading" || (status === "authenticated" && loadedUserId !== userId);

  const loadDocuments = useCallback(async () => {
    const response = await fetch("/api/side-by-side/documents", { cache: "no-store" });
    const body: unknown = await response.json();
    if (!response.ok) throw new Error(errorFromResponse(body, "Couldn't load your documents."));
    if (
      !body ||
      typeof body !== "object" ||
      !("documents" in body) ||
      !Array.isArray(body.documents) ||
      !("storageUsage" in body) ||
      !body.storageUsage ||
      typeof body.storageUsage !== "object" ||
      !("usedBytes" in body.storageUsage) ||
      typeof body.storageUsage.usedBytes !== "number" ||
      !("reservedBytes" in body.storageUsage) ||
      typeof body.storageUsage.reservedBytes !== "number" ||
      !("limitBytes" in body.storageUsage) ||
      typeof body.storageUsage.limitBytes !== "number"
    ) {
      throw new Error("The document list response was invalid.");
    }
    setDocuments(body.documents as SavedDocument[]);
    setStorageUsage({
      usedBytes: body.storageUsage.usedBytes,
      reservedBytes: body.storageUsage.reservedBytes,
      limitBytes: body.storageUsage.limitBytes,
    });
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;

    let active = true;
    void Promise.resolve()
      .then(loadDocuments)
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Couldn't load your documents.");
      })
      .finally(() => {
        if (active) setLoadedUserId(userId ?? null);
      });
    return () => {
      active = false;
    };
  }, [loadDocuments, status, userId]);

  useEffect(() => {
    if (!activeDocumentId || activeDocumentMimeType !== DOCX_MIME) return;

    let active = true;
    fetch(`/api/side-by-side/documents/${activeDocumentId}/file`)
      .then(async (response) => {
        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          throw new Error(errorFromResponse(body, "Couldn't open this document."));
        }
        return response.arrayBuffer();
      })
      .then(async (arrayBuffer) => {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ arrayBuffer });
        if (!result.value.trim()) throw new Error("This DOCX file has no readable text.");
        if (active) setLoadedDocx({ documentId: activeDocumentId, text: result.value });
      })
      .catch((cause: unknown) => {
        if (active) {
          setReaderError(cause instanceof Error ? cause.message : "Couldn't open this DOCX file.");
        }
      });

    return () => {
      active = false;
    };
  }, [activeDocumentId, activeDocumentMimeType]);

  useEffect(() => {
    if (!activeDocumentId) return;

    let active = true;
    fetch(`/api/side-by-side/documents/${activeDocumentId}/conversation`, { cache: "no-store" })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok) {
          throw new Error(errorFromResponse(body, "Couldn't load this tutor conversation."));
        }
        if (
          !body ||
          typeof body !== "object" ||
          !("messages" in body) ||
          !Array.isArray(body.messages) ||
          !body.messages.every(
            (message) =>
              !!message &&
              typeof message === "object" &&
              "role" in message &&
              (message.role === "user" || message.role === "assistant") &&
              "content" in message &&
              typeof message.content === "string"
          )
        ) {
          throw new Error("The tutor conversation response was invalid.");
        }
        if (active) setMessages(body.messages as TutorMessage[]);
      })
      .catch((cause: unknown) => {
        if (active) {
          setMessages([]);
          setTutorError(
            cause instanceof Error ? cause.message : "Couldn't load this tutor conversation."
          );
        }
      })
      .finally(() => {
        if (active) setConversationDocumentId(activeDocumentId);
      });

    return () => {
      active = false;
    };
  }, [activeDocumentId]);

  useEffect(() => {
    if (!activeDocumentId) return;

    let active = true;
    fetch(`/api/side-by-side/documents/${activeDocumentId}/highlights`, { cache: "no-store" })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok) {
          throw new Error(errorFromResponse(body, "Couldn't load saved highlights."));
        }
        if (
          !body ||
          typeof body !== "object" ||
          !("highlights" in body) ||
          !Array.isArray(body.highlights) ||
          !body.highlights.every(isSavedHighlight)
        ) {
          throw new Error("The saved highlights response was invalid.");
        }
        if (active) {
          setSavedHighlights(body.highlights);
          setHighlightsError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setSavedHighlights([]);
          setHighlightsError(
            cause instanceof Error ? cause.message : "Couldn't load saved highlights."
          );
        }
      })
      .finally(() => {
        if (active) setHighlightsDocumentId(activeDocumentId);
      });

    return () => {
      active = false;
    };
  }, [activeDocumentId]);

  useEffect(
    () => () => {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    },
    []
  );

  const saveProgress = useCallback(
    (documentId: number, progress: DocumentProgress) => {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
      setSaveMessage("Saving progress…");
      progressTimerRef.current = setTimeout(() => {
        void fetch(`/api/side-by-side/documents/${documentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(progress),
        })
          .then(async (response) => {
            if (!response.ok) {
              const body: unknown = await response.json().catch(() => null);
              throw new Error(errorFromResponse(body, "Progress couldn't be saved."));
            }
            setSaveMessage("Progress saved");
            setDocuments((current) =>
              current.map((document) =>
                document.id === documentId
                  ? {
                      ...document,
                      ...progress,
                      updatedAt: new Date().toISOString(),
                    }
                  : document
              )
            );
          })
          .catch((cause: unknown) => {
            setSaveMessage(cause instanceof Error ? cause.message : "Progress couldn't be saved.");
          });
      }, 450);
    },
    []
  );

  const handleUpload = async (file: File) => {
    setError("");
    const originalName = sanitizeDocumentName(file.name);
    const mimeType = getSideBySideMimeType(originalName);
    if (!mimeType) {
      setError("For now, Side by Side supports PDF and DOCX files.");
      return;
    }
    if (file.size < 1 || file.size > SIDE_BY_SIDE_MAX_FILE_BYTES) {
      setError("Choose a file smaller than 50 MB.");
      return;
    }
    if (!userId) {
      setError("Please sign in before uploading a document.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const ownerPath = `side-by-side/${encodeURIComponent(userId)}`;
      const extension = mimeType === "application/pdf" ? "pdf" : "docx";
      const pathname = `${ownerPath}/${crypto.randomUUID()}.${extension}`;
      const blob = await upload(pathname, file, {
        access: "private",
        contentType: mimeType,
        handleUploadUrl: "/api/side-by-side/upload",
        clientPayload: JSON.stringify({ originalName: file.name, sizeBytes: file.size }),
        onUploadProgress: ({ percentage }) => setUploadProgress(Math.round(percentage)),
      });

      const response = await fetch("/api/side-by-side/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storagePath: blob.pathname, originalName: file.name }),
      });
      const body: unknown = await response.json();
      if (!response.ok || !body || typeof body !== "object" || !("document" in body)) {
        throw new Error(errorFromResponse(body, "The file uploaded but couldn't be added to your library."));
      }

      const document = body.document as SavedDocument;
      setDocuments((current) => [document, ...current.filter((item) => item.id !== document.id)]);
      setActiveDocument(document);
      setReaderError("");
      setPageNumber(document.lastPage);
      setPageCount(Math.max(1, document.lastPage));
      updateSearchQuery("");
      setMessages([]);
      setConversationDocumentId(null);
      setSelectedText("");
      setSelectionContext("");
      setSelectionAction(null);
      setSelectionRects([]);
      setSelectionExplained(false);
      setActivePanel("tutor");
      setTutorError("");
      setHighlightsError("");
      await loadDocuments().catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? `The document was saved, but storage usage couldn't be refreshed: ${cause.message}`
            : "The document was saved, but storage usage couldn't be refreshed."
        );
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The document upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (document: SavedDocument) => {
    if (!window.confirm(`Delete “${document.originalName}” from your library?`)) return;
    setBusyDocumentId(document.id);
    setError("");
    try {
      const response = await fetch(`/api/side-by-side/documents/${document.id}`, {
        method: "DELETE",
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(errorFromResponse(body, "Couldn't delete this document."));
      setDocuments((current) => current.filter((item) => item.id !== document.id));
      await loadDocuments().catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? `The document was deleted, but storage usage couldn't be refreshed: ${cause.message}`
            : "The document was deleted, but storage usage couldn't be refreshed."
        );
      });
      if (activeDocument?.id === document.id) setActiveDocument(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't delete this document.");
    } finally {
      setBusyDocumentId(null);
    }
  };

  const handleReaderSelection = () => {
    window.requestAnimationFrame(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() ?? "";
      if (!text || !selection || selection.rangeCount === 0) {
        setSelectionAction(null);
        setSelectionRects([]);
        return;
      }
      if (text.length > 5000) {
        setSelectedText("");
        setSelectionContext("");
        setSelectionAction(null);
        setSelectionRects([]);
        setTutorError("Select a shorter passage (up to 5,000 characters) to explain it.");
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const left = Math.min(Math.max(rect.left + rect.width / 2 - 130, 12), window.innerWidth - 270);
      if (text !== selectedText || !selectionAction) setSelectionExplained(false);
      setSelectedText(text);
      setSelectionRects(getSelectionHighlightRects(range, readerContentRef.current));
      setTutorError("");

      const readerText = readerContentRef.current?.innerText ?? "";
      const position = readerText.indexOf(text);
      setSelectionContext(
        position < 0
          ? readerText.slice(0, 3000)
          : readerText.slice(Math.max(0, position - 1500), position + text.length + 1500)
      );
      setSelectionAction({ left, top: Math.max(8, rect.top - 48) });
    });
  };

  const createHighlight = async () => {
    if (
      !activeDocument ||
      !selectedText ||
      !selectionRects.length ||
      creatingHighlight ||
      highlightsLoading
    ) return;
    setCreatingHighlight(true);
    setHighlightsError("");
    try {
      const response = await fetch(
        `/api/side-by-side/documents/${activeDocument.id}/highlights`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quote: selectedText, rects: selectionRects }),
        }
      );
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(errorFromResponse(body, "Couldn't save this highlight."));
      }
      const savedResponse =
        body && typeof body === "object" && "highlight" in body ? body.highlight : null;
      if (
        !isSavedHighlight(savedResponse)
      ) {
        throw new Error("The saved highlight response was invalid.");
      }
      const saved = savedResponse;
      setSavedHighlights((current) => [...current, saved]);
      setActivePanel("highlights");
      setSelectedText("");
      setSelectionContext("");
      setSelectionRects([]);
      setSelectionAction(null);
      window.getSelection()?.removeAllRanges();
    } catch (cause) {
      setHighlightsError(cause instanceof Error ? cause.message : "Couldn't save this highlight.");
      setActivePanel("highlights");
    } finally {
      setCreatingHighlight(false);
    }
  };

  const saveHighlightNote = async (highlight: SavedHighlight) => {
    if (!activeDocument || savingNoteId !== null) return;
    setSavingNoteId(highlight.id);
    setHighlightsError("");
    try {
      const response = await fetch(
        `/api/side-by-side/documents/${activeDocument.id}/highlights/${highlight.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: highlight.note.slice(0, SIDE_BY_SIDE_HIGHLIGHT_NOTE_MAX_LENGTH) }),
        }
      );
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(errorFromResponse(body, "Couldn't save this note."));
      const savedResponse =
        body && typeof body === "object" && "highlight" in body ? body.highlight : null;
      if (!isSavedHighlight(savedResponse)) {
        throw new Error("The saved note response was invalid.");
      }
      const saved = savedResponse;
      setSavedHighlights((current) =>
        current.map((item) => item.id === highlight.id ? saved : item)
      );
      setSavedNoteId(highlight.id);
    } catch (cause) {
      setHighlightsError(cause instanceof Error ? cause.message : "Couldn't save this note.");
    } finally {
      setSavingNoteId(null);
    }
  };

  const deleteHighlight = async (highlight: SavedHighlight) => {
    if (
      !activeDocument ||
      deletingHighlightId !== null ||
      !window.confirm("Remove this saved highlight and its note?")
    ) {
      return;
    }
    setDeletingHighlightId(highlight.id);
    setHighlightsError("");
    try {
      const response = await fetch(
        `/api/side-by-side/documents/${activeDocument.id}/highlights/${highlight.id}`,
        { method: "DELETE" }
      );
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(errorFromResponse(body, "Couldn't remove this highlight."));
      setSavedHighlights((current) => current.filter((item) => item.id !== highlight.id));
    } catch (cause) {
      setHighlightsError(cause instanceof Error ? cause.message : "Couldn't remove this highlight.");
    } finally {
      setDeletingHighlightId(null);
    }
  };

  const navigateToHighlight = (highlight: SavedHighlight) => {
    const pageNumber = highlight.rects[0]?.pageNumber;
    if (!pageNumber) return;
    if (activeDocument?.mimeType === "application/pdf") {
      pendingHighlightPageRef.current = pageNumber;
      setPendingHighlightPage(pageNumber);
      setPageNumber(pageNumber);
      saveProgress(activeDocument.id, { lastPage: pageNumber });
    } else {
      const reader = readerContentRef.current;
      const page = reader?.querySelector<HTMLElement>(`[data-sbs-page="${pageNumber}"]`);
      const scrollContainer = page?.closest<HTMLElement>(".sbs-docx-scroll");
      if (page && scrollContainer) {
        const offset = page.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top;
        scrollContainer.scrollTo({ top: scrollContainer.scrollTop + offset - 24, behavior: "smooth" });
      }
    }
  };

  useEffect(() => {
    const targetPage = pendingHighlightPageRef.current;
    if (!targetPage || activeDocumentMimeType !== "application/pdf" || pageNumber !== targetPage) return;
    window.requestAnimationFrame(() => {
      const page = readerContentRef.current?.querySelector<HTMLElement>(
        `[data-sbs-page="${targetPage}"]`
      );
      if (page && readerContentRef.current) {
        const reader = readerContentRef.current;
        const offset = page.getBoundingClientRect().top - reader.getBoundingClientRect().top;
        reader.scrollTo({ top: reader.scrollTop + offset - 24, behavior: "smooth" });
      }
      pendingHighlightPageRef.current = null;
      setPendingHighlightPage(null);
    });
  }, [activeDocumentId, activeDocumentMimeType, pageNumber, pendingHighlightPage]);

  useEffect(() => {
    if (activeDocumentMimeType === "application/pdf" && readerContentRef.current) {
      readerContentRef.current.scrollTop = 0;
    }
  }, [activeDocumentId, activeDocumentMimeType, pageNumber]);

  const askTutor = async (message: string) => {
    if (!activeDocument || !selectedText || tutorBusy || conversationLoading) return;
    const normalizedMessage = message.trim().slice(0, 500);
    if (!normalizedMessage) return;

    const nextMessages = [...messages, { role: "user" as const, content: normalizedMessage }];
    setMessages(nextMessages);
    setQuestion("");
    setTutorBusy(true);
    setTutorError("");
    setSelectionExplained(true);

    try {
      const response = await fetch("/api/side-by-side/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: activeDocument.id,
          selectedText,
          context: selectionContext,
          message: normalizedMessage,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(errorFromResponse(body, "The AI tutor couldn't respond."));
      if (
        !body ||
        typeof body !== "object" ||
        !("explanation" in body) ||
        typeof body.explanation !== "string" ||
        !("messages" in body) ||
        !Array.isArray(body.messages) ||
        !body.messages.every(
          (entry) =>
            !!entry &&
            typeof entry === "object" &&
            "role" in entry &&
            (entry.role === "user" || entry.role === "assistant") &&
            "content" in entry &&
            typeof entry.content === "string"
        )
      ) {
        throw new Error("The AI tutor returned an invalid response.");
      }
      setMessages((current) => [
        ...current.slice(0, -1),
        ...(body.messages as TutorMessage[]),
      ]);
      setSelectionAction(null);
      window.getSelection()?.removeAllRanges();
      if (window.matchMedia("(max-width: 760px)").matches) {
        window.requestAnimationFrame(() => {
          aiPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } catch (cause) {
      setMessages(nextMessages.slice(0, -1));
      setSelectionExplained(false);
      setTutorError(cause instanceof Error ? cause.message : "The AI tutor couldn't respond.");
    } finally {
      setTutorBusy(false);
    }
  };

  const submitQuestion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void askTutor(question);
  };

  const deleteConversation = async () => {
    if (
      !activeDocument ||
      conversationLoading ||
      tutorBusy ||
      deletingConversation ||
      messages.length === 0
    ) {
      return;
    }
    if (!window.confirm(`Delete the tutor chat for “${activeDocument.originalName}”? This can't be undone.`)) {
      return;
    }

    setDeletingConversation(true);
    setTutorError("");
    try {
      const response = await fetch(
        `/api/side-by-side/documents/${activeDocument.id}/conversation`,
        { method: "DELETE" }
      );
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(errorFromResponse(body, "Couldn't delete this tutor conversation."));
      }
      setMessages([]);
    } catch (cause) {
      setTutorError(cause instanceof Error ? cause.message : "Couldn't delete this tutor conversation.");
    } finally {
      setDeletingConversation(false);
    }
  };

  const onPdfLoad = useCallback((count: number) => {
    setPageCount(count);
    setPageNumber((current) => Math.min(current, count));
  }, []);
  const onPdfError = useCallback((message: string) => setReaderError(message), []);
  const onPdfSearchResults = useCallback((matches: PdfSearchMatch[]) => {
    setPdfSearchMatches(matches);
    setSearchMatchCount(matches.length);
    setSearchMatchIndex(0);
    if (matches[0]) setPageNumber(matches[0].pageNumber);
  }, []);
  const onDocxSearchMatchCount = useCallback((count: number) => {
    setSearchMatchCount(count);
  }, []);

  const navigateSearch = (direction: -1 | 1) => {
    if (!searchMatchCount) return;
    const nextIndex =
      (searchMatchIndex + direction + searchMatchCount) % searchMatchCount;
    setSearchMatchIndex(nextIndex);
    if (activeDocumentMimeType === "application/pdf") {
      const match = pdfSearchMatches[nextIndex];
      if (match) setPageNumber(match.pageNumber);
    }
  };

  const updateSearchQuery = (query: string) => {
    setSearchQuery(query);
    setSearchMatchIndex(0);
    setSearchMatchCount(0);
    setPdfSearchMatches([]);
  };

  const handleDocxScroll = (lastScrollTop: number) => {
    if (!activeDocument) return;
    const documentId = activeDocument.id;
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      saveProgress(documentId, { lastScrollTop });
    }, 600);
  };

  if (status === "loading") {
    return <main className="sbs-auth-state"><LoaderCircle className="sbs-spin" /> Checking your account…</main>;
  }

  if (status !== "authenticated") {
    return (
      <main className="sbs-auth-state">
        <div className="sbs-auth-card">
          <BookOpen size={30} aria-hidden />
          <h1>Study Side by Side</h1>
          <p>Sign in to save your documents and continue studying them later.</p>
          <Link className="sbs-primary-button" href="/login">Sign in to QuizTime</Link>
          <Link className="sbs-back-link" href="/">Back to QuizTime</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="sbs-app">
      <header className="sbs-topbar">
        <div className="sbs-brand">
          <span className="sbs-brand-icon"><BookOpen size={19} aria-hidden /></span>
          <div>
            <p className="sbs-eyebrow">QUIZTIME STUDY MODE</p>
            <h1>Side by Side</h1>
          </div>
        </div>
        <Link className="sbs-back-link" href="/">
          <ArrowLeft size={16} aria-hidden /> QuizTime
        </Link>
      </header>

      {error && <div className="sbs-alert" role="alert">{error}</div>}

      {!activeDocument ? (
        <section className="sbs-library">
          <div className="sbs-library-heading">
            <div>
              <p className="sbs-eyebrow">YOUR READING DESK</p>
              <h2>Documents</h2>
              <p>Upload a PDF or Word document and ask AI about any passage.</p>
            </div>
            <button
              className="sbs-primary-button"
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <LoaderCircle className="sbs-spin" size={18} /> : <UploadCloud size={18} />}
              {uploading ? `Uploading ${uploadProgress}%` : "Upload a document"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
          </div>

          <div className="sbs-upload-note">
            PDF and DOCX · up to 50 MB per file · 500 MB total storage · files are private to your account
          </div>
          <div className="sbs-storage-usage" aria-label="Side by Side storage usage">
            <div className="sbs-storage-usage-label">
              <span>Storage used</span>
              <strong>
                {formatSize(storageUsage.usedBytes + storageUsage.reservedBytes)} of{" "}
                {formatSize(storageUsage.limitBytes)}
              </strong>
            </div>
            <progress
              max={storageUsage.limitBytes}
              value={Math.min(
                storageUsage.usedBytes + storageUsage.reservedBytes,
                storageUsage.limitBytes
              )}
              aria-label="Storage quota used"
            />
          </div>

          {loadingDocuments ? (
            <div className="sbs-empty-state"><LoaderCircle className="sbs-spin" /> Loading your documents…</div>
          ) : documents.length === 0 ? (
            <div className="sbs-empty-state">
              <span className="sbs-empty-icon"><FileText size={28} aria-hidden /></span>
              <h3>Your reading desk is ready</h3>
              <p>Upload a course handout to read it here and get an AI explanation whenever you need one.</p>
              <button className="sbs-secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>
                Choose a PDF or DOCX
              </button>
            </div>
          ) : (
            <div className="sbs-document-list">
              {documents.map((document) => (
                <article className="sbs-document-card" key={document.id}>
                  <button
                    className="sbs-document-open"
                    type="button"
                    onClick={() => {
                      setActiveDocument(document);
                      setPageNumber(document.lastPage);
                      setPageCount(Math.max(1, document.lastPage));
                      updateSearchQuery("");
                      setMessages([]);
                      setConversationDocumentId(null);
                      setSelectedText("");
                      setSelectionContext("");
                      setSelectionAction(null);
                      setSelectionRects([]);
                      setSelectionExplained(false);
                      setActivePanel("tutor");
                      setSaveMessage("");
                      setReaderError("");
                      setTutorError("");
                      setHighlightsError("");
                    }}
                  >
                    <span className="sbs-file-icon"><FileText size={20} aria-hidden /></span>
                    <span className="sbs-document-info">
                      <strong>{document.originalName}</strong>
                      <span>{formatSize(document.sizeBytes)} · {formatDate(document.updatedAt)}</span>
                    </span>
                    <span className="sbs-resume-label">
                      {document.mimeType === "application/pdf"
                        ? `Continue · page ${document.lastPage}`
                        : "Continue reading"}
                      <ArrowRight size={15} aria-hidden />
                    </span>
                  </button>
                  <button
                    className="sbs-delete-button"
                    type="button"
                    aria-label={`Delete ${document.originalName}`}
                    disabled={busyDocumentId === document.id}
                    onClick={() => void handleDelete(document)}
                  >
                    {busyDocumentId === document.id
                      ? <LoaderCircle className="sbs-spin" size={17} />
                      : <Trash2 size={17} aria-hidden />}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="sbs-document-toolbar">
            <button
              type="button"
              className="sbs-toolbar-back"
              onClick={() => {
                setActiveDocument(null);
                setConversationDocumentId(null);
                setSelectionAction(null);
                setSelectedText("");
                setSelectionContext("");
                setSelectionRects([]);
                setSelectionExplained(false);
                void loadDocuments().catch((cause: unknown) => {
                  setError(cause instanceof Error ? cause.message : "Couldn't refresh your documents.");
                });
              }}
            >
              <ArrowLeft size={17} aria-hidden /> Documents
            </button>
            <div className="sbs-open-document-name" title={activeDocument.originalName}>
              <FileText size={16} aria-hidden />
              <span>{activeDocument.originalName}</span>
            </div>
            <div className="sbs-document-search" role="search">
              <Search size={16} aria-hidden />
              <label className="sbs-sr-only" htmlFor="sbs-document-search-input">
                Search in document
              </label>
              <input
                id="sbs-document-search-input"
                type="search"
                value={searchQuery}
                onChange={(event) => updateSearchQuery(event.target.value)}
                placeholder="Find in document"
                autoComplete="off"
              />
              <span className="sbs-search-count" aria-live="polite">
                {searchQuery.trim()
                  ? `${searchMatchCount ? searchMatchIndex + 1 : 0} of ${searchMatchCount}`
                  : ""}
              </span>
              <button
                type="button"
                aria-label="Previous search result"
                disabled={!searchMatchCount}
                onClick={() => navigateSearch(-1)}
              >
                <ArrowLeft size={14} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Next search result"
                disabled={!searchMatchCount}
                onClick={() => navigateSearch(1)}
              >
                <ArrowRight size={14} aria-hidden />
              </button>
            </div>
            <span className="sbs-save-state" aria-live="polite">{saveMessage}</span>
            {activeDocument.mimeType === "application/pdf" && (
              <div className="sbs-page-controls" aria-label="PDF page controls">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={pageNumber <= 1}
                  onClick={() => {
                    const nextPage = Math.max(1, pageNumber - 1);
                    setPageNumber(nextPage);
                    saveProgress(activeDocument.id, { lastPage: nextPage });
                  }}
                >
                  <ArrowLeft size={16} aria-hidden />
                </button>
                <span>Page {pageNumber} of {pageCount}</span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={pageNumber >= pageCount}
                  onClick={() => {
                    const nextPage = Math.min(pageCount, pageNumber + 1);
                    setPageNumber(nextPage);
                    saveProgress(activeDocument.id, { lastPage: nextPage });
                  }}
                >
                  <ArrowRight size={16} aria-hidden />
                </button>
              </div>
            )}
          </div>

          <div className="sbs-workspace">
            <section className="sbs-reader-panel" aria-label="Document reader">
              <div
                ref={readerContentRef}
                className={`sbs-reader-content${activeDocument.mimeType === DOCX_MIME ? " sbs-reader-content-docx" : ""}`}
                onMouseUp={handleReaderSelection}
                onTouchEnd={handleReaderSelection}
              >
                {readerError ? (
                  <div className="sbs-reader-message" role="alert">{readerError}</div>
                ) : activeDocument.mimeType === "application/pdf" ? (
                  <PdfDocumentViewer
                    fileUrl={`/api/side-by-side/documents/${activeDocument.id}/file`}
                    pageNumber={pageNumber}
                    searchQuery={searchQuery}
                    activeSearchMatch={searchMatchIndex}
                    searchMatches={pdfSearchMatches}
                    highlights={currentHighlights}
                    onLoad={onPdfLoad}
                    onError={onPdfError}
                    onSearchResults={onPdfSearchResults}
                  />
                ) : documentLoading ? (
                  <div className="sbs-reader-message"><LoaderCircle className="sbs-spin" /> Opening Word document…</div>
                ) : (
                  <DocxDocumentViewer
                    key={activeDocument.id}
                    documentId={activeDocument.id}
                    originalName={activeDocument.originalName}
                    text={docxText}
                    searchQuery={searchQuery}
                    activeSearchMatch={searchMatchIndex}
                    initialScrollTop={activeDocumentLastScrollTop}
                    onScroll={handleDocxScroll}
                    onSearchMatchCount={onDocxSearchMatchCount}
                    highlights={currentHighlights}
                  />
                )}
              </div>
              {selectionAction && selectedText && !selectionExplained && !tutorBusy && (
                <div
                  className="sbs-selection-actions"
                  style={{ left: selectionAction.left, top: selectionAction.top }}
                >
                  <button
                    type="button"
                    className="sbs-highlight-selection"
                    disabled={creatingHighlight || !selectionRects.length}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void createHighlight()}
                  >
                    {creatingHighlight
                      ? <LoaderCircle className="sbs-spin" size={15} />
                      : <Highlighter size={15} aria-hidden />}
                    Highlight
                  </button>
                  <button
                    type="button"
                    className="sbs-explain-selection"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void askTutor("Explain this passage in simple terms.")}
                  >
                    <Sparkles size={15} aria-hidden /> Explain with AI
                  </button>
                </div>
              )}
            </section>

            <aside ref={aiPanelRef} className="sbs-ai-panel" aria-label="AI explanation panel">
              <div className={`sbs-ai-heading${messages.length ? " sbs-ai-heading-has-chat" : ""}`}>
                <span className="sbs-ai-icon"><Sparkles size={17} aria-hidden /></span>
                <div>
                  <h2>AI Study Partner</h2>
                  <p>Grounded in your selected passage</p>
                </div>
                {activePanel === "tutor" && messages.length > 0 && (
                  <button
                    type="button"
                    className="sbs-clear-chat"
                    aria-label="Delete tutor chat"
                    title="Delete tutor chat"
                    disabled={conversationLoading || tutorBusy || deletingConversation}
                    onClick={() => void deleteConversation()}
                  >
                    {deletingConversation
                      ? <LoaderCircle className="sbs-spin" size={16} />
                      : <Trash2 size={16} aria-hidden />}
                  </button>
                )}
                {activePanel === "tutor" && selectedText && (
                  <button
                    type="button"
                    className="sbs-clear-selection"
                    aria-label="Clear selected passage"
                    onClick={() => {
                      setSelectedText("");
                      setSelectionContext("");
                      setTutorError("");
                    }}
                  >
                    <X size={17} aria-hidden />
                  </button>
                )}
              </div>

              <div className="sbs-panel-tabs" role="tablist" aria-label="Study panel">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePanel === "tutor"}
                  onClick={() => setActivePanel("tutor")}
                >
                  <MessageCircle size={15} aria-hidden /> AI Tutor
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activePanel === "highlights"}
                  onClick={() => setActivePanel("highlights")}
                >
                  <Highlighter size={15} aria-hidden /> Highlights
                  <span>{currentHighlights.length}</span>
                </button>
              </div>

              {activePanel === "tutor" ? (
                <>
                  {selectedText ? (
                    <div className="sbs-selected-passage">
                      <p>SELECTED PASSAGE</p>
                      <blockquote>{selectedText}</blockquote>
                    </div>
                  ) : (
                    <div className="sbs-ai-welcome">
                      <span><MessageCircle size={22} aria-hidden /></span>
                      <strong>Start with a highlight</strong>
                      <p>Select any text in the document, then choose “Explain with AI”.</p>
                    </div>
                  )}

                  {tutorError && <p className="sbs-tutor-error" role="alert">{tutorError}</p>}

                  <div className="sbs-chat" aria-live="polite">
                    {conversationLoading && (
                      <div className="sbs-message sbs-message-assistant sbs-thinking">
                        <LoaderCircle className="sbs-spin" size={16} /> Loading saved conversation…
                      </div>
                    )}
                    {!conversationLoading && messages.map((message, index) => (
                      <div className={`sbs-message sbs-message-${message.role}`} key={`${index}-${message.role}`}>
                        <span className="sbs-message-speaker">
                          {message.role === "user" ? "You" : "Tutor"}
                        </span>
                        <p>{message.content}</p>
                      </div>
                    ))}
                    {tutorBusy && (
                      <div className="sbs-message sbs-message-assistant sbs-thinking">
                        <LoaderCircle className="sbs-spin" size={16} /> Thinking through the passage…
                      </div>
                    )}
                  </div>

                  <form className="sbs-question-form" onSubmit={submitQuestion}>
                    <label className="sbs-sr-only" htmlFor="sbs-question">Ask a follow-up question</label>
                    <textarea
                      id="sbs-question"
                      value={question}
                      maxLength={500}
                      disabled={!selectedText || tutorBusy || conversationLoading}
                      onChange={(event) => setQuestion(event.target.value)}
                      placeholder={selectedText ? "Ask a follow-up…" : "Highlight a passage to start"}
                      rows={2}
                    />
                    <button type="submit" disabled={!selectedText || !question.trim() || tutorBusy || conversationLoading} aria-label="Send question">
                      {tutorBusy ? <LoaderCircle className="sbs-spin" size={17} /> : <Send size={17} aria-hidden />}
                    </button>
                  </form>
                  <p className="sbs-ai-footnote">AI can make mistakes. Check important details against your material.</p>
                </>
              ) : (
                <div className="sbs-highlights-panel">
                  {highlightsError && <p className="sbs-tutor-error" role="alert">{highlightsError}</p>}
                  {highlightsLoading ? (
                    <div className="sbs-highlights-empty"><LoaderCircle className="sbs-spin" size={18} /> Loading saved highlights…</div>
                  ) : currentHighlights.length === 0 ? (
                    <div className="sbs-highlights-empty">
                      <NotebookPen size={24} aria-hidden />
                      <strong>No saved highlights yet</strong>
                      <p>Select a passage in the document and choose Highlight to save it here.</p>
                    </div>
                  ) : (
                    currentHighlights.map((highlight) => (
                      <article className="sbs-highlight-card" key={highlight.id}>
                        <button
                          type="button"
                          className="sbs-highlight-quote"
                          onClick={() => navigateToHighlight(highlight)}
                          aria-label={`Jump to page ${highlight.rects[0]?.pageNumber}: ${highlight.quote}`}
                        >
                          <span>Page {highlight.rects[0]?.pageNumber ?? "—"}</span>
                          <q>{highlight.quote}</q>
                        </button>
                        <label>
                          <span className="sbs-sr-only">Note for this highlight</span>
                          <textarea
                            maxLength={SIDE_BY_SIDE_HIGHLIGHT_NOTE_MAX_LENGTH}
                            rows={2}
                            placeholder="Add a note (optional)"
                            value={highlight.note}
                            onChange={(event) => {
                              setSavedNoteId((current) => current === highlight.id ? null : current);
                              setSavedHighlights((current) =>
                                current.map((item) =>
                                  item.id === highlight.id
                                    ? { ...item, note: event.target.value }
                                    : item
                                )
                              );
                            }}
                          />
                        </label>
                        <div className="sbs-highlight-actions">
                          <button
                            type="button"
                            onClick={() => void saveHighlightNote(highlight)}
                            disabled={savingNoteId !== null || highlight.note.length > SIDE_BY_SIDE_HIGHLIGHT_NOTE_MAX_LENGTH}
                          >
                            {savingNoteId === highlight.id
                              ? <LoaderCircle className="sbs-spin" size={14} />
                              : savedNoteId === highlight.id
                                ? <Check size={14} aria-hidden />
                                : <Save size={14} aria-hidden />}
                            {savedNoteId === highlight.id ? "Saved" : "Save note"}
                          </button>
                          <button
                            type="button"
                            aria-label="Delete saved highlight"
                            title="Delete saved highlight"
                            onClick={() => void deleteHighlight(highlight)}
                            disabled={deletingHighlightId !== null}
                          >
                            {deletingHighlightId === highlight.id
                              ? <LoaderCircle className="sbs-spin" size={14} />
                              : <Trash2 size={14} aria-hidden />}
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
