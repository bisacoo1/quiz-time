"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Flashcard {
  id?: number;
  question: string;
  answer: string;
  hint?: string | null;
  difficulty: string;
  orderIndex?: number;
}

interface CardProgress {
  cardId: number;
  isKnown: boolean;
  attempts: number;
}

interface StudySession {
  id: number;
  title: string;
  sourceType: string;
  createdAt: string;
  cardCount: number;
}

type Tab = "home" | "upload" | "quiz" | "sessions";
type QuizMode = "flashcard" | "review";

// ─── Icons ───────────────────────────────────────────────────────────────────
const Icons = {
  Home: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  ),
  Upload: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
    </svg>
  ),
  Cards: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
    </svg>
  ),
  Sessions: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
    </svg>
  ),
  Star: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  ),
  Close: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  ),
  ArrowLeft: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
    </svg>
  ),
  ArrowRight: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  ),
  Delete: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
    </svg>
  ),
  Bulb: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
    </svg>
  ),
  Trophy: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  Sparkle: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  ),
  Image: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
    </svg>
  ),
  PDF: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" />
    </svg>
  ),
  Keyboard: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z" />
    </svg>
  ),
};

// ─── Confetti ────────────────────────────────────────────────────────────────
function launchConfetti() {
  const colors = ["#ff6b9d", "#a855f7", "#fbbf24", "#10b981", "#60a5fa", "#f43f5e"];
  for (let i = 0; i < 60; i++) {
    setTimeout(() => {
      const el = document.createElement("div");
      el.className = "confetti-piece";
      el.style.left = `${Math.random() * 100}vw`;
      el.style.top = "-10px";
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.width = `${6 + Math.random() * 8}px`;
      el.style.height = `${6 + Math.random() * 8}px`;
      el.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
      el.style.animationDuration = `${2 + Math.random() * 2}s`;
      el.style.animationDelay = `${Math.random() * 0.5}s`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    }, i * 30);
  }
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function showToast(msg: string, emoji = "✨") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = `${emoji} ${msg}`;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add("show"));
  });
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 2800);
}

// ─── FlashCard Component ─────────────────────────────────────────────────────
function FlashCard({
  card,
  index,
  total,
  onKnow,
  onDontKnow,
  onNext,
  onPrev,
  progress,
}: {
  card: Flashcard;
  index: number;
  total: number;
  onKnow: () => void;
  onDontKnow: () => void;
  onNext: () => void;
  onPrev: () => void;
  progress: CardProgress | undefined;
}) {
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [answering, setAnswering] = useState(false);

  useEffect(() => {
    setFlipped(false);
    setShowHint(false);
    setAnswering(false);
  }, [index]);

  const handleFlip = () => {
    if (!flipped) setFlipped(true);
  };

  const handleKnow = () => {
    setAnswering(true);
    setTimeout(() => {
      onKnow();
      setAnswering(false);
    }, 300);
  };

  const handleDontKnow = () => {
    setAnswering(true);
    setTimeout(() => {
      onDontKnow();
      setAnswering(false);
    }, 300);
  };

  const difficultyColor = {
    easy: "#10b981",
    medium: "#f59e0b",
    hard: "#e91e8c",
  }[card.difficulty] || "#a855f7";

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Progress */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onPrev} disabled={index === 0} style={{ padding: "6px 10px", borderRadius: 12 }}>
          <Icons.ArrowLeft />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
            <span>Card {index + 1} of {total}</span>
            <span className="badge" style={{ background: `${difficultyColor}20`, color: difficultyColor }}>
              {card.difficulty}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onNext} disabled={index === total - 1} style={{ padding: "6px 10px", borderRadius: 12 }}>
          <Icons.ArrowRight />
        </button>
      </div>

      {/* Card */}
      <div
        className="card-container"
        style={{ height: 320, cursor: flipped ? "default" : "pointer" }}
        onClick={!flipped ? handleFlip : undefined}
      >
        <div className={`card-inner ${flipped ? "flipped" : ""}`}>
          {/* Front */}
          <div
            className="card-front glass-card"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 28,
              background: "linear-gradient(135deg, #fff0f9, #f5f0ff)",
              border: "2px solid rgba(233,30,140,0.15)",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🤔</div>
            <p style={{ textAlign: "center", fontSize: 18, fontWeight: 700, color: "var(--text)", lineHeight: 1.4, margin: 0 }}>
              {card.question}
            </p>
            {!flipped && (
              <p style={{ marginTop: 20, fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
                Tap to reveal answer 💫
              </p>
            )}
          </div>

          {/* Back */}
          <div
            className="card-back glass-card"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 28,
              background: "linear-gradient(135deg, #f0fff8, #f0f4ff)",
              border: "2px solid rgba(16,185,129,0.2)",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>💡</div>
            <p style={{ textAlign: "center", fontSize: 16, fontWeight: 600, color: "var(--text)", lineHeight: 1.5, margin: 0, overflowY: "auto", maxHeight: 200 }}>
              {card.answer}
            </p>
          </div>
        </div>
      </div>

      {/* Hint */}
      {card.hint && !flipped && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowHint(!showHint)}
          style={{ alignSelf: "center", color: "#f59e0b", gap: 6 }}
        >
          <Icons.Bulb />
          {showHint ? "Hide hint" : "Show hint"}
        </button>
      )}
      {showHint && card.hint && !flipped && (
        <div style={{
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: 12,
          padding: "10px 16px",
          fontSize: 14,
          color: "#92400e",
          textAlign: "center",
          animation: "fadeIn 0.3s ease",
        }}>
          💡 {card.hint}
        </div>
      )}

      {/* Action buttons */}
      {flipped && (
        <div className="animate-slide-up" style={{ display: "flex", gap: 12 }}>
          <button
            className="btn btn-danger"
            style={{ flex: 1, opacity: answering ? 0.7 : 1 }}
            onClick={handleDontKnow}
            disabled={answering}
          >
            <Icons.Close />
            Still Learning
          </button>
          <button
            className="btn btn-success"
            style={{ flex: 1, opacity: answering ? 0.7 : 1 }}
            onClick={handleKnow}
            disabled={answering}
          >
            <Icons.Check />
            Got it! ✓
          </button>
        </div>
      )}

      {/* Progress indicator */}
      {progress && (
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
          {progress.isKnown ? "✅ Marked as known" : "🔄 Still learning"} · {progress.attempts} attempt{progress.attempts !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// ─── Review Summary ───────────────────────────────────────────────────────────
function ReviewSummary({
  cards,
  progress,
  onRestart,
  onReviewWeak,
}: {
  cards: Flashcard[];
  progress: CardProgress[];
  onRestart: () => void;
  onReviewWeak: () => void;
}) {
  const known = progress.filter((p) => p.isKnown).length;
  const total = cards.length;
  const pct = Math.round((known / total) * 100);

  useEffect(() => {
    if (pct >= 80) launchConfetti();
  }, [pct]);

  const emoji = pct >= 90 ? "🏆" : pct >= 70 ? "🌟" : pct >= 50 ? "💪" : "📚";
  const message =
    pct >= 90
      ? "Outstanding! You're a genius! 🎉"
      : pct >= 70
      ? "Great job! Keep it up! 💪"
      : pct >= 50
      ? "Good progress! Review the ones you missed! 📖"
      : "Keep studying! You've got this! 💖";

  return (
    <div className="animate-fade-in" style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontSize: 80 }}>{emoji}</div>
      <h2 className="gradient-text" style={{ fontSize: 28, fontWeight: 800, margin: "8px 0 4px" }}>
        Session Complete!
      </h2>
      <p style={{ color: "var(--text-muted)", margin: "0 0 24px", fontSize: 15 }}>{message}</p>

      {/* Score circle */}
      <div
        style={{
          width: 140,
          height: 140,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--pink-dark), var(--purple))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
          boxShadow: "0 8px 32px rgba(233,30,140,0.3)",
        }}
      >
        <span style={{ fontSize: 40, fontWeight: 900, color: "white" }}>{pct}%</span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>Score</span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total", value: total, color: "#a855f7", bg: "#f5f0ff" },
          { label: "Known ✅", value: known, color: "#10b981", bg: "#f0fff8" },
          { label: "Review 📚", value: total - known, color: "#e91e8c", bg: "#fff0f9" },
        ].map((s) => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 16, padding: "14px 8px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {total - known > 0 && (
          <button className="btn btn-primary btn-lg" onClick={onReviewWeak} style={{ width: "100%" }}>
            <Icons.Refresh />
            Review {total - known} Missed Cards
          </button>
        )}
        <button className="btn btn-secondary" onClick={onRestart} style={{ width: "100%" }}>
          <Icons.Refresh />
          Restart All Cards
        </button>
      </div>
    </div>
  );
}

// ─── Upload Page ──────────────────────────────────────────────────────────────
function UploadPage({ onCardsReady }: { onCardsReady: (cards: Flashcard[], title: string, summary: string, sourceType: string) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [textInput, setTextInput] = useState("");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [preview, setPreview] = useState<{ name: string; type: string; size: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isPDF = file.type === "application/pdf";
    if (!isImage && !isPDF) {
      setError("Please upload a PDF or image file (JPG, PNG, WEBP)");
      return;
    }
    setPreview({
      name: file.name,
      type: isPDF ? "PDF" : "Image",
      size: `${(file.size / 1024).toFixed(1)} KB`,
    });
    setError("");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      let sourceType = "text";

      if (mode === "file") {
        const file = fileRef.current?.files?.[0];
        if (!file) { setError("Please select a file first"); setLoading(false); return; }
        formData.append("file", file);
        sourceType = file.type === "application/pdf" ? "pdf" : "image";
      } else {
        if (!textInput.trim()) { setError("Please enter some text to study"); setLoading(false); return; }
        formData.append("text", textInput.trim());
        sourceType = "text";
      }

      const res = await fetch("/api/scan", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to process content");
      }

      onCardsReady(data.cards, data.title, data.summary, sourceType);
      showToast(`Generated ${data.cards.length} flashcards!`, "🎉");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: "20px 16px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>
        📤 Upload Study Material
      </h2>
      <p style={{ color: "var(--text-muted)", margin: "0 0 20px", fontSize: 14 }}>
        Upload a PDF, screenshot, or paste text to generate flashcards!
      </p>

      {/* Mode toggle */}
      <div style={{ display: "flex", background: "#f3e8ff", borderRadius: 50, padding: 4, marginBottom: 20, gap: 4 }}>
        {[
          { id: "file" as const, label: "📄 File / Image", icon: null },
          { id: "text" as const, label: "⌨️ Paste Text", icon: null },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setError(""); setPreview(null); }}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 50,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 14,
              transition: "all 0.2s",
              background: mode === m.id ? "linear-gradient(135deg, var(--pink-dark), var(--purple))" : "transparent",
              color: mode === m.id ? "white" : "var(--text-muted)",
              boxShadow: mode === m.id ? "0 2px 12px rgba(233,30,140,0.3)" : "none",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "file" ? (
        <>
          <div
            className={`upload-zone ${dragOver ? "drag-over" : ""}`}
            style={{ padding: "40px 20px", textAlign: "center", marginBottom: 16 }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
              capture="environment"
            />
            <div style={{ fontSize: 56, marginBottom: 12 }}>
              {preview ? (preview.type === "PDF" ? "📄" : "🖼️") : "📁"}
            </div>
            {preview ? (
              <div>
                <p style={{ fontWeight: 700, fontSize: 16, margin: "0 0 4px", color: "var(--pink-dark)" }}>
                  {preview.name}
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
                  {preview.type} · {preview.size}
                </p>
              </div>
            ) : (
              <div>
                <p style={{ fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>
                  Tap to upload or drag & drop
                </p>
                <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
                  Supports PDF, JPG, PNG, WEBP
                </p>
              </div>
            )}
          </div>

          {/* Quick options for mobile */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (fileRef.current) {
                  fileRef.current.accept = "image/*";
                  fileRef.current.setAttribute("capture", "environment");
                  fileRef.current.click();
                }
              }}
            >
              <Icons.Image />
              Camera
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (fileRef.current) {
                  fileRef.current.accept = ".pdf,image/*";
                  fileRef.current.removeAttribute("capture");
                  fileRef.current.click();
                }
              }}
            >
              <Icons.PDF />
              Gallery / Files
            </button>
          </div>
        </>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste your notes, book excerpt, or any study text here... The AI will turn it into flashcards! 📚"
            style={{
              width: "100%",
              minHeight: 200,
              padding: "16px",
              borderRadius: 16,
              border: "2px solid #f3e8ff",
              fontSize: 14,
              lineHeight: 1.6,
              resize: "vertical",
              fontFamily: "inherit",
              outline: "none",
              color: "var(--text)",
              background: "white",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--pink-dark)")}
            onBlur={(e) => (e.target.style.borderColor = "#f3e8ff")}
          />
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0", textAlign: "right" }}>
            {textInput.length} characters
          </p>
        </div>
      )}

      {error && (
        <div style={{
          background: "#fce7f3",
          border: "1px solid #fbcfe8",
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 16,
          color: "#9d174d",
          fontSize: 14,
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
        }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <button
        className="btn btn-primary btn-lg"
        style={{ width: "100%", position: "relative" }}
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <>
            <div className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5, borderColor: "rgba(255,255,255,0.4)", borderTopColor: "white" }} />
            Generating Flashcards...
          </>
        ) : (
          <>
            <Icons.Sparkle />
            Generate Flashcards with AI ✨
          </>
        )}
      </button>

      {loading && (
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", marginTop: 12 }}>
          🤖 AI is reading your material... This may take a moment!
        </p>
      )}
    </div>
  );
}

// ─── Quiz Page ────────────────────────────────────────────────────────────────
function QuizPage({
  sessionId,
  cards,
  title,
  summary,
  onSave,
  onBack,
}: {
  sessionId?: number;
  cards: Flashcard[];
  title: string;
  summary: string;
  onSave?: (title: string) => Promise<void>;
  onBack: () => void;
}) {
  const [activeCards, setActiveCards] = useState(cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState<CardProgress[]>([]);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!sessionId);

  // Load progress from server if we have a sessionId
  useEffect(() => {
    if (sessionId) {
      fetch(`/api/sessions/${sessionId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.progress) setProgress(data.progress);
        })
        .catch(() => {});
    }
  }, [sessionId]);

  const currentCard = activeCards[currentIndex];
  const currentProgress = currentCard?.id
    ? progress.find((p) => p.cardId === currentCard.id)
    : undefined;

  const updateProgress = async (cardId: number | undefined, isKnown: boolean) => {
    if (sessionId && cardId) {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, isKnown }),
      });
    }
    if (cardId) {
      setProgress((prev) => {
        const existing = prev.find((p) => p.cardId === cardId);
        if (existing) {
          return prev.map((p) => p.cardId === cardId ? { ...p, isKnown, attempts: p.attempts + 1 } : p);
        }
        return [...prev, { cardId, isKnown, attempts: 1 }];
      });
    }
  };

  const handleKnow = async () => {
    await updateProgress(currentCard?.id, true);
    if (currentIndex >= activeCards.length - 1) {
      setDone(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleDontKnow = async () => {
    await updateProgress(currentCard?.id, false);
    if (currentIndex >= activeCards.length - 1) {
      setDone(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleRestart = () => {
    setActiveCards(cards);
    setCurrentIndex(0);
    setDone(false);
  };

  const handleReviewWeak = () => {
    const knownIds = new Set(progress.filter((p) => p.isKnown).map((p) => p.cardId));
    const weak = cards.filter((c) => !c.id || !knownIds.has(c.id));
    if (weak.length === 0) return handleRestart();
    setActiveCards(weak);
    setCurrentIndex(0);
    setDone(false);
  };

  const handleSave = async () => {
    if (!onSave || saved) return;
    setSaving(true);
    try {
      await onSave(title);
      setSaved(true);
      showToast("Study set saved! 💾", "✅");
    } catch {
      showToast("Failed to save", "❌");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ padding: "6px 10px", borderRadius: 12 }}>
          <Icons.ArrowLeft />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}
          </h2>
          {summary && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {summary}
            </p>
          )}
        </div>
        {onSave && !saved && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSave}
            disabled={saving}
            style={{ flexShrink: 0 }}
          >
            {saving ? "..." : "💾 Save"}
          </button>
        )}
        {saved && (
          <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700, flexShrink: 0 }}>✅ Saved</span>
        )}
      </div>

      {done ? (
        <ReviewSummary
          cards={cards}
          progress={progress}
          onRestart={handleRestart}
          onReviewWeak={handleReviewWeak}
        />
      ) : (
        <FlashCard
          card={currentCard}
          index={currentIndex}
          total={activeCards.length}
          onKnow={handleKnow}
          onDontKnow={handleDontKnow}
          onNext={() => setCurrentIndex((i) => Math.min(i + 1, activeCards.length - 1))}
          onPrev={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
          progress={currentProgress}
        />
      )}
    </div>
  );
}

// ─── Sessions Page ────────────────────────────────────────────────────────────
function SessionsPage({ onOpen }: { onOpen: (id: number) => void }) {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      showToast("Failed to load sessions", "❌");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this study set?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      showToast("Deleted!", "🗑️");
    } catch {
      showToast("Failed to delete", "❌");
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / 3600000;
    if (hours < 1) return "Just now";
    if (hours < 24) return `${Math.floor(hours)}h ago`;
    if (hours < 48) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const typeIcon = (type: string) => {
    if (type === "pdf") return "📄";
    if (type === "image") return "🖼️";
    return "⌨️";
  };

  return (
    <div style={{ padding: "20px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📚 My Study Sets</h2>
        <button className="btn btn-ghost btn-sm" onClick={load} style={{ padding: "6px 10px" }}>
          <Icons.Refresh />
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer" style={{ height: 80, borderRadius: 16 }} />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📭</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>No study sets yet!</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
            Upload a PDF or image to create your first flashcard set 💕
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sessions.map((session, i) => (
            <div
              key={session.id}
              className="glass-card animate-fade-in"
              style={{
                padding: "16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 14,
                animationDelay: `${i * 0.05}s`,
                transition: "transform 0.15s",
              }}
              onClick={() => onOpen(session.id)}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onTouchStart={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
              onTouchEnd={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "linear-gradient(135deg, #fce4f0, #f0e6ff)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                flexShrink: 0,
              }}>
                {typeIcon(session.sourceType)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {session.title}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                  {session.cardCount} cards · {formatDate(session.createdAt)}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: "6px", color: "#f43f5e", opacity: deleting === session.id ? 0.5 : 1 }}
                  onClick={(e) => handleDelete(session.id, e)}
                  disabled={deleting === session.id}
                >
                  <Icons.Delete />
                </button>
                <Icons.ArrowRight />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────
function HomePage({ onUpload, onSessions }: { onUpload: () => void; onSessions: () => void }) {
  return (
    <div style={{ padding: "20px 16px" }}>
      {/* Hero */}
      <div
        style={{
          background: "linear-gradient(135deg, #e91e8c, #a855f7)",
          borderRadius: 24,
          padding: "28px 24px",
          marginBottom: 24,
          color: "white",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 120,
          height: 120,
          background: "rgba(255,255,255,0.1)",
          borderRadius: "50%",
        }} />
        <div style={{
          position: "absolute",
          bottom: -30,
          right: 30,
          width: 80,
          height: 80,
          background: "rgba(255,255,255,0.08)",
          borderRadius: "50%",
        }} />
        <div className="animate-heartbeat" style={{ fontSize: 48, marginBottom: 12 }}>💕</div>
        <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 900, lineHeight: 1.2 }}>
          QuizTime
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, opacity: 0.9, lineHeight: 1.5 }}>
          Upload your study material and I&apos;ll make it into fun flashcards for you! 🌟
        </p>
        <button
          className="btn"
          style={{ background: "white", color: "var(--pink-dark)", fontWeight: 800, fontSize: 15 }}
          onClick={onUpload}
        >
          <Icons.Sparkle />
          Start Studying ✨
        </button>
      </div>

      {/* Features */}
      <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 14px" }}>How it works 💡</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { icon: "📄", title: "Upload PDF", desc: "Upload any PDF document" },
          { icon: "📸", title: "Take Photo", desc: "Snap a photo of your notes" },
          { icon: "🤖", title: "AI Magic", desc: "AI reads & extracts key points" },
          { icon: "🃏", title: "Flashcards", desc: "Review with fun flip cards" },
        ].map((f, i) => (
          <div
            key={i}
            className="glass-card animate-fade-in"
            style={{ padding: "16px 14px", animationDelay: `${i * 0.1}s` }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>{f.icon}</div>
            <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 14 }}>{f.title}</p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div style={{
        background: "linear-gradient(135deg, #fff0f9, #f5f0ff)",
        border: "1.5px solid #f3e8ff",
        borderRadius: 18,
        padding: "18px 16px",
        marginBottom: 16,
      }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 800 }}>💖 Study Tips</h3>
        {[
          "Review cards daily for best retention!",
          "Focus on 'Still Learning' cards more.",
          "Take breaks every 25 minutes (Pomodoro!)",
          "Explain answers in your own words.",
        ].map((tip, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13, color: "var(--text-muted)" }}>
            <span>⭐</span>
            <span>{tip}</span>
          </div>
        ))}
      </div>

      <button
        className="btn btn-secondary"
        style={{ width: "100%" }}
        onClick={onSessions}
      >
        <Icons.Sessions />
        View My Study Sets
      </button>
    </div>
  );
}

// ─── Setup Page ───────────────────────────────────────────────────────────────
function SetupPage() {
  return (
    <div style={{ padding: "20px 16px" }}>
      <div style={{
        background: "#fffbeb",
        border: "2px solid #fde68a",
        borderRadius: 20,
        padding: "24px 20px",
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 48, marginBottom: 12, textAlign: "center" }}>🔑</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800, textAlign: "center" }}>
          Setup Required
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#92400e", textAlign: "center", lineHeight: 1.6 }}>
          To use the AI flashcard generator, you need a free <strong>Google Gemini API key</strong>.
        </p>
        <div style={{ background: "white", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "#1e1b4b", lineHeight: 1.7 }}>
          <strong>Steps:</strong>
          <ol style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
            <li>Go to <strong>aistudio.google.com</strong></li>
            <li>Sign in with Google</li>
            <li>Click &quot;Get API Key&quot;</li>
            <li>Copy the key</li>
            <li>Add to your <code style={{ background: "#f3e8ff", padding: "1px 6px", borderRadius: 4 }}>.env</code> file:</li>
          </ol>
          <div style={{ background: "#1e1b4b", color: "#a5f3fc", borderRadius: 8, padding: "10px 14px", marginTop: 10, fontSize: 12, fontFamily: "monospace" }}>
            GEMINI_API_KEY=your_key_here
          </div>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
        The Gemini API has a generous free tier — no credit card needed! 💖
      </p>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [pendingCards, setPendingCards] = useState<Flashcard[] | null>(null);
  const [pendingTitle, setPendingTitle] = useState("");
  const [pendingSummary, setPendingSummary] = useState("");
  const [pendingSourceType, setPendingSourceType] = useState("text");
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [activeSessionCards, setActiveSessionCards] = useState<Flashcard[] | null>(null);
  const [activeSessionTitle, setActiveSessionTitle] = useState("");
  const [activeSessionSummary, setActiveSessionSummary] = useState("");
  const [hasApiKey, setHasApiKey] = useState(true);

  // Check if API key is configured
  useEffect(() => {
    fetch("/api/scan", { method: "POST", body: new FormData() })
      .then((r) => r.json())
      .then((data) => {
        if (data.error && data.error.includes("GEMINI_API_KEY")) {
          setHasApiKey(false);
        }
      })
      .catch(() => {});
  }, []);

  const handleCardsReady = (cards: Flashcard[], title: string, summary: string, sourceType: string) => {
    setPendingCards(cards);
    setPendingTitle(title);
    setPendingSummary(summary);
    setPendingSourceType(sourceType);
    setActiveSessionId(null);
    setTab("quiz");
  };

  const handleSaveSession = async (title: string) => {
    if (!pendingCards) return;
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        sourceType: pendingSourceType,
        cards: pendingCards,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setActiveSessionId(data.session.id);
    setPendingCards(data.cards);
  };

  const handleOpenSession = async (id: number) => {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActiveSessionId(id);
      setActiveSessionCards(data.cards);
      setActiveSessionTitle(data.session.title);
      setActiveSessionSummary("");
      setPendingCards(null);
      setTab("quiz");
    } catch {
      showToast("Failed to load session", "❌");
    }
  };

  const isViewingSession = activeSessionCards !== null && activeSessionId !== null && !pendingCards;

  const renderContent = () => {
    if (tab === "quiz") {
      const cards = isViewingSession ? activeSessionCards! : pendingCards!;
      const title = isViewingSession ? activeSessionTitle : pendingTitle;
      const summary = isViewingSession ? activeSessionSummary : pendingSummary;

      return (
        <QuizPage
          sessionId={activeSessionId ?? undefined}
          cards={cards}
          title={title}
          summary={summary}
          onSave={!isViewingSession ? handleSaveSession : undefined}
          onBack={() => {
            setTab(isViewingSession ? "sessions" : "upload");
            if (isViewingSession) setActiveSessionCards(null);
            else setPendingCards(null);
          }}
        />
      );
    }

    if (tab === "home") return <HomePage onUpload={() => setTab("upload")} onSessions={() => setTab("sessions")} />;
    if (tab === "upload") {
      if (!hasApiKey) return <SetupPage />;
      return <UploadPage onCardsReady={handleCardsReady} />;
    }
    if (tab === "sessions") return <SessionsPage onOpen={handleOpenSession} />;
    return null;
  };

  const navItems = [
    { id: "home" as Tab, label: "Home", Icon: Icons.Home },
    { id: "upload" as Tab, label: "Upload", Icon: Icons.Upload },
    { id: "sessions" as Tab, label: "My Sets", Icon: Icons.Sessions },
  ];

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", position: "relative" }}>
      {/* Top bar */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(253, 244, 255, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(243, 232, 255, 0.8)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.png" alt="QuizTime" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }} />
        <div>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 900 }} className="gradient-text">
            QuizTime
          </h1>
          <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Your AI Study Partner</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {!hasApiKey && (
            <span style={{ fontSize: 12, background: "#fef3c7", color: "#92400e", padding: "4px 10px", borderRadius: 999, fontWeight: 600 }}>
              ⚙️ Setup
            </span>
          )}
        </div>
      </div>

      {/* Page content */}
      <div className="page-content">
        {renderContent()}
      </div>

      {/* Bottom nav */}
      <nav className="nav-bottom">
        {navItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-item ${tab === id ? "active" : ""}`}
            onClick={() => {
              setTab(id);
              setPendingCards(null);
              setActiveSessionCards(null);
            }}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
