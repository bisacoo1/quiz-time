"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";

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
  knownCount?: number;
}

type Tab = "home" | "upload" | "quiz" | "sessions";
type QuizMode = "select" | "study" | "exam";

interface ExamQuestion {
  card: Flashcard;
  options: string[];
  correctIndex: number;
}

interface ExamAnswer {
  card: Flashcard;
  chosenIndex: number;
  chosenOption: string;
  correctIndex: number;
  isCorrect: boolean;
  points: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const FALLBACK_OPTIONS = [
  "None of the above",
  "All of the above",
  "Not mentioned in the material",
  "It cannot be determined",
];

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Build multiple-choice questions: correct answer + 3 distractors taken from other cards. */
function buildExamQuestions(cards: Flashcard[]): ExamQuestion[] {
  return shuffle(cards).map((card) => {
    const correct = card.answer;
    const pool = cards
      .filter((c) => c !== card && normalize(c.answer) !== normalize(correct))
      .map((c) => c.answer);

    // Prefer distractors of a similar length to the correct answer so the
    // odd-one-out isn't obvious at a glance.
    pool.sort((a, b) => Math.abs(a.length - correct.length) - Math.abs(b.length - correct.length));

    const seen = new Set([normalize(correct)]);
    const distractors: string[] = [];
    for (const candidate of [...shuffle(pool.slice(0, 12)), ...FALLBACK_OPTIONS]) {
      if (distractors.length >= 3) break;
      const key = normalize(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      distractors.push(candidate);
    }

    const options = shuffle([correct, ...distractors]);
    return { card, options, correctIndex: options.indexOf(correct) };
  });
}

/** Points for a correct answer: 10 base + difficulty bonus. */
function pointsFor(card: Flashcard): number {
  const bonus = card.difficulty === "hard" ? 10 : card.difficulty === "medium" ? 5 : 0;
  return 10 + bonus;
}

function gradeFor(pct: number) {
  if (pct >= 95) return { grade: "A+", message: "Flawless! You nailed it! 🏆", emoji: "🏆", color: "#10b981" };
  if (pct >= 90) return { grade: "A", message: "Excellent work! 🎉", emoji: "🎉", color: "#22c55e" };
  if (pct >= 80) return { grade: "B", message: "Great job, keep it up! 💪", emoji: "🌟", color: "#3b82f6" };
  if (pct >= 70) return { grade: "C", message: "Good effort — review and retry! 📖", emoji: "📖", color: "#6366f1" };
  if (pct >= 60) return { grade: "D", message: "Keep studying, you'll get there! 💫", emoji: "💫", color: "#f59e0b" };
  return { grade: "F", message: "Don't give up — study mode can help! 💙", emoji: "📚", color: "#f43f5e" };
}

/**
 * Phone photos are often 3–10 MB (and sometimes arrive as HEIC or with an
 * empty mime type), which hosting platforms and the Gemini API both reject.
 * Downscale to a normal JPEG before uploading; if anything fails we just
 * send the original file.
 */
async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  try {
    if (!file.type.startsWith("image/") || file.size <= 600 * 1024) return file;

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

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
  Book: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2H9c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h9c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H9V4h9v12zM3 15v-2h2v2H3zm0 4v-2h2v2H3zm0-8V9h2v2H3zm0-4V5h2v2H3zm0 12c-1.1 0-2 .9-2 2h2v-2zm0-16c-1.1 0-2 .9-2 2h2V3z" />
    </svg>
  ),
  Exam: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-1.5 15.5L7 15l1.41-1.41L10.5 15.67l4.59-4.59L16.5 12.5l-6 6z" />
    </svg>
  ),
  Flame: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5 1.5c.3 2.4-.6 4.2-2.2 5.6-1.1 1-2.3 1.7-2.3 3.4 0 .8.3 1.5.8 2-.1-2.6 1.6-3.9 2.7-5C13.6 6.3 14.3 4.7 13.5 1.5zM11 22c-3.3 0-6-2.5-6-5.6 0-2.4 1.2-3.9 2.6-5.3 1-1 2-2 2.4-3.2.5 1.2 1.4 1.9 2.3 2.6 1.2 1 2.7 2.2 2.7 4.3C17 19.1 14.4 22 11 22z" />
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z" />
    </svg>
  ),
  Target: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm0-13a5 5 0 100 10 5 5 0 000-10zm0 8a3 3 0 110-6 3 3 0 010 6z" />
    </svg>
  ),
  Shuffle: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
    </svg>
  ),
};

// ─── Confetti ────────────────────────────────────────────────────────────────
function launchConfetti() {
  const colors = ["#3b82f6", "#7c3aed", "#38bdf8", "#10b981", "#fbbf24", "#f43f5e"];
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

// ─── Study Mode: traditional flashcard (flip to reveal) ─────────────────────
function StudyCard({
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
    hard: "#f43f5e",
  }[card.difficulty] || "#6366f1";

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
              background: "linear-gradient(135deg, #eff6ff, #eef2ff)",
              border: "2px solid rgba(37,99,235,0.15)",
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
              background: "linear-gradient(135deg, #ecfeff, #eff6ff)",
              border: "2px solid rgba(16,185,129,0.25)",
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
          background: "linear-gradient(135deg, var(--accent-dark), var(--purple))",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
          boxShadow: "0 8px 32px rgba(37,99,235,0.3)",
        }}
      >
        <span style={{ fontSize: 40, fontWeight: 900, color: "white" }}>{pct}%</span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>Score</span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total", value: total, color: "#3b82f6", bg: "#eef2ff" },
          { label: "Known ✅", value: known, color: "#10b981", bg: "#f0fff8" },
          { label: "Review 📚", value: total - known, color: "#f43f5e", bg: "#eff6ff" },
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
type PickedFile = {
  id: string;
  file: File;
  kind: "PDF" | "Image" | "Word";
  previewUrl?: string;
};

const MAX_FILES = 8;
const MAX_TOTAL_MB = 24;

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function isPDFFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
}

function isWordFile(file: File): boolean {
  return (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type === "application/msword" ||
    /\.docx?$/i.test(file.name || "")
  );
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || "");
}

function UploadPage({ onCardsReady }: { onCardsReady: (cards: Flashcard[], title: string, summary: string, sourceType: string) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [textInput, setTextInput] = useState("");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickedRef = useRef<PickedFile[]>([]);

  useEffect(() => {
    pickedRef.current = picked;
  }, [picked]);

  // Release thumbnail URLs when the screen goes away
  useEffect(
    () => () => {
      pickedRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    },
    []
  );

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (incoming.length === 0) return;

      const accepted: PickedFile[] = [];
      let rejected = 0;

      for (const file of incoming) {
        const pdf = isPDFFile(file);
        const image = isImageFile(file);
        const word = isWordFile(file);
        if (!pdf && !image && !word) {
          rejected++;
          continue;
        }
        if (picked.some((item) => item.file.name === file.name && item.file.size === file.size)) {
          continue; // already added
        }
        accepted.push({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          kind: pdf ? "PDF" : word ? "Word" : "Image",
          previewUrl: image ? URL.createObjectURL(file) : undefined,
        });
      }

      const room = Math.max(0, MAX_FILES - picked.length);
      const kept = accepted.slice(0, room);

      if (rejected > 0) {
        setError("Only PDF, Word (.docx) or image files (JPG, PNG, WEBP) are supported.");
      } else if (accepted.length > kept.length) {
        setError(`You can upload up to ${MAX_FILES} files at a time.`);
      } else {
        setError("");
      }

      if (kept.length > 0) {
        setPicked((prev) => [...prev, ...kept]);
      }
    },
    [picked]
  );

  const removeFile = (id: string) => {
    const target = picked.find((item) => item.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    setPicked((prev) => prev.filter((item) => item.id !== id));
    setError("");
  };

  const clearFiles = () => {
    picked.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setPicked([]);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      addFiles(Array.from(e.dataTransfer.files || []));
    },
    [addFiles]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) addFiles(files);
    e.target.value = ""; // allow picking the same file again
  };

  const handleSubmit = async () => {
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      let sourceType = "text";

      if (mode === "file") {
        if (picked.length === 0) {
          setError("Please add at least one PDF or photo");
          setLoading(false);
          return;
        }

        const totalBytes = picked.reduce((sum, item) => sum + item.file.size, 0);
        if (totalBytes > MAX_TOTAL_MB * 1024 * 1024) {
          setError(`That's ${formatSize(totalBytes)} in total — please keep it under ${MAX_TOTAL_MB} MB by removing a few files.`);
          setLoading(false);
          return;
        }

        for (const item of picked) {
          const optimized = await compressImage(item.file);
          formData.append("file", optimized);
        }

        const pdfs = picked.filter((item) => item.kind === "PDF").length;
        const words = picked.filter((item) => item.kind === "Word").length;
        const images = picked.filter((item) => item.kind === "Image").length;
        sourceType =
          picked.length === 1
            ? pdfs === 1
              ? "pdf"
              : words === 1
              ? "docx"
              : "image"
            : images === picked.length
            ? "image"
            : "mixed";
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

  const totalBytes = picked.reduce((sum, item) => sum + item.file.size, 0);
  const photos = picked.filter((item) => item.kind === "Image").length;

  return (
    <div className="animate-fade-in" style={{ padding: "20px 16px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>
        📤 Upload Study Material
      </h2>
      <p style={{ color: "var(--text-muted)", margin: "0 0 20px", fontSize: 14 }}>
        Upload PDFs, Word docs or photos — you can select several at once — or paste text!
      </p>

      {/* Mode toggle */}
      <div style={{ display: "flex", background: "#dbeafe", borderRadius: 50, padding: 4, marginBottom: 20, gap: 4 }}>
        {[
          { id: "file" as const, label: "📄 Files / Photos", icon: null },
          { id: "text" as const, label: "⌨️ Paste Text", icon: null },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setError(""); }}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 50,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 14,
              transition: "all 0.2s",
              background: mode === m.id ? "linear-gradient(135deg, var(--accent-dark), var(--violet))" : "transparent",
              color: mode === m.id ? "white" : "var(--text-muted)",
              boxShadow: mode === m.id ? "0 2px 12px rgba(37,99,235,0.3)" : "none",
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
            style={{ padding: picked.length ? "26px 20px" : "40px 20px", textAlign: "center", marginBottom: 16 }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,image/*"
              multiple
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <div style={{ fontSize: 48, marginBottom: 10 }}>
              {picked.length ? "🖼️" : "📁"}
            </div>
            <p style={{ fontWeight: 700, fontSize: 16, margin: "0 0 6px" }}>
              {picked.length ? "Add more files" : "Tap to upload or drag & drop"}
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
              {picked.length
                ? `${picked.length} of ${MAX_FILES} added · ${formatSize(totalBytes)}`
                : `PDF, Word, JPG, PNG, WEBP · up to ${MAX_FILES} files`}
            </p>
          </div>

          {/* Selected files */}
          {picked.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
                  {picked.length} file{picked.length === 1 ? "" : "s"} selected · {formatSize(totalBytes)}
                </p>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={(e) => { e.stopPropagation(); clearFiles(); }}
                >
                  Clear all
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {picked.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      position: "relative",
                      aspectRatio: "1 / 1",
                      borderRadius: 14,
                      overflow: "hidden",
                      border: "2px solid #dbeafe",
                      background: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {item.previewUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.previewUrl}
                        alt={item.file.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ fontSize: 34 }}>{item.kind === "Word" ? "📝" : "📄"}</div>
                    )}
                    <button
                      className="remove-btn"
                      onClick={(e) => { e.stopPropagation(); removeFile(item.id); }}
                      aria-label={`Remove ${item.file.name}`}
                    >
                      <Icons.Close />
                    </button>
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        padding: "12px 6px 5px",
                        background: "linear-gradient(transparent, rgba(15,35,63,0.85))",
                        color: "white",
                        fontSize: 10,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.file.name}
                    </span>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "10px 0 0", textAlign: "center" }}>
                {picked.length > 1
                  ? `All ${picked.length} files (${photos} photo${photos === 1 ? "" : "s"}) are combined into one study set 📚`
                  : "Ready to generate ✨"}
              </p>
            </div>
          )}

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
                  fileRef.current.accept = ".pdf,.doc,.docx,image/*";
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
              border: "2px solid #dbeafe",
              fontSize: 14,
              lineHeight: 1.6,
              resize: "vertical",
              fontFamily: "inherit",
              outline: "none",
              color: "var(--text)",
              background: "white",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent-dark)")}
            onBlur={(e) => (e.target.style.borderColor = "#dbeafe")}
          />
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0", textAlign: "right" }}>
            {textInput.length} characters
          </p>
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#dbeafe",
            border: "1px solid #bfdbfe",
            borderRadius: 12,
            padding: "12px 16px",
            marginBottom: 16,
            color: "#9f1239",
            fontSize: 14,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
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
            {mode === "file" && picked.length > 1
              ? `Reading ${picked.length} files...`
              : "Generating Flashcards..."}
          </>
        ) : (
          <>
            <Icons.Sparkle />
            {mode === "file" && picked.length > 1
              ? `Generate from ${picked.length} files ✨`
              : "Generate Flashcards with AI ✨"}
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

// ─── Mode Select ─────────────────────────────────────────────────────────────
function ModeSelect({
  cardCount,
  onSelect,
}: {
  cardCount: number;
  onSelect: (mode: "study" | "exam") => void;
}) {
  return (
    <div className="animate-fade-in" style={{ padding: "4px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div className="animate-float" style={{ fontSize: 44, marginBottom: 6 }}>🎯</div>
        <h2 style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 800 }}>How do you want to study?</h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>
          {cardCount} card{cardCount === 1 ? "" : "s"} ready · pick a mode to begin
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Study mode */}
        <button className="mode-card" onClick={() => onSelect("study")}>
          <div className="mode-icon" style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
            <Icons.Book />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>Study Mode</p>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Traditional flashcards — see the question, then flip the card to reveal the answer.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["Flip to reveal", "Self-check", "Track progress"].map((t) => (
                <span key={t} className="badge" style={{ background: "#eff6ff", color: "#1d4ed8" }}>{t}</span>
              ))}
            </div>
          </div>
        </button>

        {/* Exam mode */}
        <button className="mode-card" onClick={() => onSelect("exam")}>
          <div className="mode-icon" style={{ background: "linear-gradient(135deg, #1d4ed8, #7c3aed)" }}>
            <Icons.Exam />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>Exam Mode</p>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Multiple choice — 4 options per question, instant Correct / Wrong feedback and a score.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["4 choices", "Instant feedback", "Scored"].map((t) => (
                <span key={t} className="badge" style={{ background: "#eef2ff", color: "#6d28d9" }}>{t}</span>
              ))}
            </div>
          </div>
        </button>
      </div>

      <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 18 }}>
        Tip: warm up in <strong>Study Mode</strong>, then test yourself in <strong>Exam Mode</strong> 💙
      </p>
    </div>
  );
}

// ─── Exam Mode: multiple choice question card ────────────────────────────────
function ExamCard({
  question,
  index,
  total,
  chosen,
  earnedPoints,
  onChoose,
  onNext,
  isLast,
}: {
  question: ExamQuestion;
  index: number;
  total: number;
  chosen: number | null;
  earnedPoints: number;
  onChoose: (optionIndex: number) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const { card, options, correctIndex } = question;
  const answered = chosen !== null;
  const isCorrect = chosen === correctIndex;

  const difficultyColor = {
    easy: "#10b981",
    medium: "#f59e0b",
    hard: "#f43f5e",
  }[card.difficulty] || "#6366f1";

  // Keyboard: 1-4 to answer, Enter / Space to continue
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!answered) {
        const n = Number(e.key);
        if (n >= 1 && n <= options.length) onChoose(n - 1);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answered, options.length, onChoose, onNext]);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Progress */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
          <span>Question {index + 1} of {total}</span>
          <span className="badge" style={{ background: `${difficultyColor}20`, color: difficultyColor }}>
            {card.difficulty}
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
      </div>

      {/* Question */}
      <div
        className="glass-card"
        style={{
          padding: 22,
          borderLeft: "5px solid var(--accent-dark)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minHeight: 130,
        }}
      >
        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: "var(--accent-dark)", textTransform: "uppercase" }}>
          Choose the best answer
        </p>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.45 }}>
          {card.question}
        </p>
      </div>

      {/* Choices */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map((opt, i) => {
          let cls = "choice";
          let mark: ReactNode = null;
          if (answered) {
            if (i === correctIndex) {
              cls += " reveal-correct";
              mark = <span style={{ marginLeft: "auto", fontSize: 18 }}>✅</span>;
            } else if (i === chosen) {
              cls += " selected-wrong";
              mark = <span style={{ marginLeft: "auto", fontSize: 18 }}>❌</span>;
            } else {
              cls += " dimmed";
            }
          }
          return (
            <button
              key={`${index}-${i}`}
              className={cls}
              disabled={answered}
              onClick={() => onChoose(i)}
            >
              <span className="choice-letter">{String.fromCharCode(65 + i)}</span>
              <span className="choice-text">{opt}</span>
              {mark}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {answered && (
        <>
          <div className={`feedback ${isCorrect ? "feedback-correct" : "feedback-wrong"}`}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{isCorrect ? "🎉" : "😅"}</span>
            <span>
              <strong>{isCorrect ? "Correct!" : "Wrong!"}</strong>
              {isCorrect
                ? earnedPoints > 0
                  ? ` +${earnedPoints} point${earnedPoints === 1 ? "" : "s"}`
                  : ""
                : ` The correct answer is: ${card.answer}`}
            </span>
          </div>

          <button className="btn btn-primary btn-lg" style={{ width: "100%" }} onClick={onNext}>
            {isLast ? "See Results 🏁" : "Next Question"}
            {!isLast && <Icons.ArrowRight />}
          </button>
        </>
      )}

      {!answered && (
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
          Tip: press <strong>1–4</strong> to answer quickly ⌨️
        </p>
      )}
    </div>
  );
}

// ─── Exam Mode: results screen ───────────────────────────────────────────────
function ExamSummary({
  answers,
  score,
  maxScore,
  bestStreak,
  elapsed,
  onRetry,
  onStudyMissed,
  onBackToModes,
}: {
  answers: ExamAnswer[];
  score: number;
  maxScore: number;
  bestStreak: number;
  elapsed: number;
  onRetry: () => void;
  onStudyMissed: () => void;
  onBackToModes: () => void;
}) {
  const total = answers.length;
  const correct = answers.filter((a) => a.isCorrect).length;
  const wrong = total - correct;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const { grade, message, emoji, color } = gradeFor(pct);
  const missed = answers.filter((a) => !a.isCorrect);

  useEffect(() => {
    if (pct >= 80) launchConfetti();
  }, [pct]);

  return (
    <div className="animate-fade-in" style={{ textAlign: "center", padding: "10px 0" }}>
      <div style={{ fontSize: 72 }}>{emoji}</div>
      <h2 className="gradient-text" style={{ fontSize: 27, fontWeight: 800, margin: "6px 0 4px" }}>
        Exam Complete!
      </h2>
      <p style={{ color: "var(--text-muted)", margin: "0 0 22px", fontSize: 15 }}>{message}</p>

      {/* Score ring */}
      <div
        className="score-ring"
        style={{ background: `linear-gradient(135deg, ${color}, #1d4ed8)` }}
      >
        <span style={{ fontSize: 40, fontWeight: 900, lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 12, opacity: 0.9, fontWeight: 600 }}>accuracy</span>
      </div>

      {/* Grade + score */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <span className="badge" style={{ background: `${color}1a`, color, fontSize: 14, padding: "6px 14px" }}>
          Grade: {grade}
        </span>
        <span className="badge" style={{ background: "#eef2ff", color: "#4338ca", fontSize: 14, padding: "6px 14px" }}>
          ⭐ {score} / {maxScore} pts
        </span>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        {[
          { label: "Correct ✅", value: correct, color: "#10b981", bg: "#ecfdf5" },
          { label: "Wrong ❌", value: wrong, color: "#f43f5e", bg: "#fff1f2" },
          { label: "Questions", value: total, color: "#3b82f6", bg: "#eff6ff" },
        ].map((s) => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 16, padding: "14px 8px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        <div style={{ background: "white", borderRadius: 16, padding: "12px 8px", boxShadow: "0 4px 16px rgba(29,78,216,0.08)" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#ea580c" }}>🔥 {bestStreak}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Best streak</div>
        </div>
        <div style={{ background: "white", borderRadius: 16, padding: "12px 8px", boxShadow: "0 4px 16px rgba(29,78,216,0.08)" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#1d4ed8" }}>⏱ {formatTime(elapsed)}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Time taken</div>
        </div>
      </div>

      {/* Missed questions */}
      {missed.length > 0 && (
        <div style={{ textAlign: "left", marginBottom: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, margin: "0 0 10px" }}>
            📕 Review missed questions ({missed.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {missed.map((a, i) => (
              <div
                key={i}
                style={{
                  background: "white",
                  border: "1.5px solid #fecdd3",
                  borderRadius: 16,
                  padding: "12px 14px",
                }}
              >
                <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, lineHeight: 1.45 }}>
                  {a.card.question}
                </p>
                <p style={{ margin: "0 0 4px", fontSize: 13, display: "flex", gap: 6 }}>
                  <span>❌</span>
                  <span style={{ color: "#9f1239" }}>Your answer: {a.chosenOption}</span>
                </p>
                <p style={{ margin: 0, fontSize: 13, display: "flex", gap: 6 }}>
                  <span>✅</span>
                  <span style={{ color: "#065f46", fontWeight: 600 }}>{a.card.answer}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {missed.length > 0 && (
          <button className="btn btn-primary btn-lg" style={{ width: "100%" }} onClick={onStudyMissed}>
            <Icons.Book />
            Study {missed.length} Missed Card{missed.length === 1 ? "" : "s"}
          </button>
        )}
        <button className="btn btn-secondary" style={{ width: "100%" }} onClick={onRetry}>
          <Icons.Shuffle />
          Retake Exam (New Order)
        </button>
        <button className="btn btn-ghost" style={{ width: "100%" }} onClick={onBackToModes}>
          <Icons.ArrowLeft />
          Back to Modes
        </button>
      </div>
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
  const [mode, setMode] = useState<QuizMode>("select");

  // Shared
  const [progress, setProgress] = useState<CardProgress[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!sessionId);

  // Study mode
  const [activeCards, setActiveCards] = useState(cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [shuffleStudy, setShuffleStudy] = useState(false);
  const [unknownOnly, setUnknownOnly] = useState(false);

  // Exam mode
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [examIndex, setExamIndex] = useState(0);
  const [answers, setAnswers] = useState<ExamAnswer[]>([]);
  const [score, setScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [examDone, setExamDone] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

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
      fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId, isKnown }),
      }).catch(() => {});
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

  // ── Study mode ────────────────────────────────────────────────────────────
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

  /** Rebuild the study deck, honoring the shuffle + "unknown only" toggles. */
  const buildStudyDeck = (useShuffle: boolean, useUnknownOnly: boolean) => {
    let base = cards;
    if (useUnknownOnly) {
      const knownIds = new Set(progress.filter((p) => p.isKnown).map((p) => p.cardId));
      base = base.filter((c) => !(c.id && knownIds.has(c.id)));
    }
    return useShuffle ? shuffle(base) : base;
  };

  const toggleShuffle = () => {
    const next = !shuffleStudy;
    setShuffleStudy(next);
    setActiveCards(buildStudyDeck(next, unknownOnly));
    setCurrentIndex(0);
    setDone(false);
  };

  const toggleUnknownOnly = () => {
    const next = !unknownOnly;
    setUnknownOnly(next);
    setActiveCards(buildStudyDeck(shuffleStudy, next));
    setCurrentIndex(0);
    setDone(false);
  };

  const showAllCards = () => {
    setUnknownOnly(false);
    setActiveCards(buildStudyDeck(shuffleStudy, false));
    setCurrentIndex(0);
    setDone(false);
  };

  // ── Exam mode ─────────────────────────────────────────────────────────────
  const startExam = (questionCards?: Flashcard[]) => {
    const qs = buildExamQuestions(questionCards ?? cards);
    setExamQuestions(qs);
    setExamIndex(0);
    setAnswers([]);
    setScore(0);
    setMaxScore(
      qs.reduce((sum, q, i) => sum + pointsFor(q.card) + (i === 0 ? 0 : Math.min(i * 2, 10)), 0)
    );
    setStreak(0);
    setBestStreak(0);
    setExamDone(false);
    setStartedAt(Date.now());
    setElapsed(0);
    setMode("exam");
  };

  const handleChoose = async (optionIndex: number) => {
    const q = examQuestions[examIndex];
    if (!q || answers.length > examIndex) return; // ignore clicks after answering

    const isCorrect = optionIndex === q.correctIndex;
    const newStreak = isCorrect ? streak + 1 : 0;
    const streakBonus = isCorrect ? Math.min(streak * 2, 10) : 0;
    const points = isCorrect ? pointsFor(q.card) + streakBonus : 0;

    setAnswers((prev) => [
      ...prev,
      {
        card: q.card,
        chosenIndex: optionIndex,
        chosenOption: q.options[optionIndex],
        correctIndex: q.correctIndex,
        isCorrect,
        points,
      },
    ]);
    setScore((s) => s + points);
    setStreak(newStreak);
    setBestStreak((b) => Math.max(b, newStreak));
    await updateProgress(q.card.id, isCorrect);
  };

  const handleExamNext = () => {
    if (examIndex >= examQuestions.length - 1) {
      setElapsed(Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
      setExamDone(true);
    } else {
      setExamIndex((i) => i + 1);
    }
  };

  const handleStudyMissed = () => {
    const missed = answers.filter((a) => !a.isCorrect).map((a) => a.card);
    if (missed.length === 0) return;
    setActiveCards(missed);
    setCurrentIndex(0);
    setDone(false);
    setMode("study");
  };

  // ── Mode switching ────────────────────────────────────────────────────────
  const switchMode = (m: "study" | "exam") => {
    if (m === "study") {
      // Respect the shuffle / unknown-only toggles if they're on.
      setActiveCards(buildStudyDeck(shuffleStudy, unknownOnly));
      setCurrentIndex(0);
      setDone(false);
      setMode("study");
    } else {
      startExam();
    }
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

  const examQuestion = examQuestions[examIndex];
  const lastAnswer = answers[answers.length - 1];

  return (
    <div style={{ padding: "16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
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

      {/* Mode switch */}
      {mode !== "select" && (
        <div style={{ marginBottom: 14 }}>
          <div className="mode-switch">
            <button
              className={mode === "study" ? "active" : ""}
              onClick={() => switchMode("study")}
            >
              <Icons.Book />
              Study Mode
            </button>
            <button
              className={mode === "exam" ? "active" : ""}
              onClick={() => switchMode("exam")}
            >
              <Icons.Exam />
              Exam Mode
            </button>
          </div>

          {/* Study-mode toggles */}
          {mode === "study" && !done && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                className={`btn btn-sm ${shuffleStudy ? "btn-primary" : "btn-secondary"}`}
                onClick={toggleShuffle}
                style={{ flex: 1, gap: 6 }}
              >
                <Icons.Shuffle />
                Shuffle {shuffleStudy ? "On" : "Off"}
              </button>
              <button
                className={`btn btn-sm ${unknownOnly ? "btn-primary" : "btn-secondary"}`}
                onClick={toggleUnknownOnly}
                style={{ flex: 1, gap: 6 }}
              >
                📗 Unknown only {unknownOnly ? "On" : "Off"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Live exam scoreboard */}
      {mode === "exam" && !examDone && examQuestion && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span className="score-pill">
            <Icons.Star />
            {score} pts
          </span>
          <span className={`score-pill ${streak >= 3 ? "streak-hot" : "streak"}`}>
            <Icons.Flame />
            {streak} streak
          </span>
          <span className="score-pill" style={{ marginLeft: "auto" }}>
            <Icons.Target />
            {answers.length}/{examQuestions.length}
          </span>
        </div>
      )}

      {/* Content */}
      {mode === "select" && (
        <ModeSelect cardCount={cards.length} onSelect={switchMode} />
      )}

      {mode === "study" && !done && currentCard && (
        <StudyCard
          key={currentIndex}
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

      {mode === "study" && !done && !currentCard && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>
            {unknownOnly ? "🎉" : "📭"}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>
            {unknownOnly ? "No unknown cards left!" : "No cards to study"}
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: 14, margin: "0 0 20px" }}>
            {unknownOnly
              ? "You've marked every card in this set as known. Great work!"
              : "This set has no cards."}
          </p>
          {unknownOnly && (
            <button className="btn btn-primary" onClick={showAllCards}>
              <Icons.Refresh />
              Show all {cards.length} cards
            </button>
          )}
        </div>
      )}

      {mode === "study" && done && (
        <ReviewSummary
          cards={cards}
          progress={progress}
          onRestart={handleRestart}
          onReviewWeak={handleReviewWeak}
        />
      )}

      {mode === "exam" && !examDone && examQuestion && (
        <ExamCard
          key={`${examIndex}-${examQuestions.length}`}
          question={examQuestion}
          index={examIndex}
          total={examQuestions.length}
          chosen={answers.length > examIndex ? answers[examIndex].chosenIndex : null}
          earnedPoints={lastAnswer && lastAnswer.card === examQuestion.card ? lastAnswer.points : 0}
          onChoose={handleChoose}
          onNext={handleExamNext}
          isLast={examIndex === examQuestions.length - 1}
        />
      )}

      {mode === "exam" && examDone && (
        <ExamSummary
          answers={answers}
          score={score}
          maxScore={maxScore}
          bestStreak={bestStreak}
          elapsed={elapsed}
          onRetry={() => startExam()}
          onStudyMissed={handleStudyMissed}
          onBackToModes={() => setMode("select")}
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

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions", signal ? { signal } : undefined);
      const data = await res.json();
      if (signal?.aborted) return;
      setSessions(data.sessions || []);
    } catch {
      if (signal?.aborted) return;
      showToast("Failed to load sessions", "❌");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  // Load on mount. The request is kicked off from an async IIFE so the effect
  // body never calls setState synchronously, and the fetch is aborted if the
  // screen unmounts before it settles.
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await load(controller.signal);
    })();
    return () => controller.abort();
  }, [load]);

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
    if (type === "docx") return "📝";
    if (type === "mixed") return "🗂️";
    return "⌨️";
  };

  return (
    <div style={{ padding: "20px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📚 My Study Sets</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => load()} style={{ padding: "6px 10px" }}>
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
                background: "linear-gradient(135deg, #e0f2fe, #eef2ff)",
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
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span>
                    {session.cardCount} card{session.cardCount === 1 ? "" : "s"} · {formatDate(session.createdAt)}
                  </span>
                  {typeof session.knownCount === "number" && (
                    <span
                      className="badge"
                      style={{
                        background: session.knownCount >= session.cardCount && session.cardCount > 0 ? "#d1fae5" : "#dbeafe",
                        color: session.knownCount >= session.cardCount && session.cardCount > 0 ? "#047857" : "#1d4ed8",
                      }}
                    >
                      {session.knownCount >= session.cardCount && session.cardCount > 0
                        ? "✅ All known"
                        : `📗 ${session.knownCount}/${session.cardCount} known`}
                    </span>
                  )}
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
          background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
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
        <div className="animate-heartbeat" style={{ fontSize: 48, marginBottom: 12 }}>💙</div>
        <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 900, lineHeight: 1.2 }}>
          QuizTime
        </h1>
        <p style={{ margin: "0 0 20px", fontSize: 14, opacity: 0.9, lineHeight: 1.5 }}>
          Upload your study material and I&apos;ll make it into fun flashcards — then study them or take an exam! 🌟
        </p>
        <button
          className="btn"
          style={{ background: "white", color: "var(--accent-dark)", fontWeight: 800, fontSize: 15 }}
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
          { icon: "📖", title: "Study Mode", desc: "Flip the card to reveal the answer" },
          { icon: "📝", title: "Exam Mode", desc: "4 choices, instant score" },
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
        background: "linear-gradient(135deg, #eff6ff, #ecfeff)",
        border: "1.5px solid #bfdbfe",
        borderRadius: 18,
        padding: "18px 16px",
        marginBottom: 16,
      }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 800 }}>💖 Study Tips</h3>
        {[
          "Review cards daily for best retention!",
          "Focus on 'Still Learning' cards more.",
          "Study first, then take Exam Mode to test yourself.",
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
            <li>Add to your <code style={{ background: "#dbeafe", padding: "1px 6px", borderRadius: 4 }}>.env</code> file:</li>
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

// ─── Draft deck persistence ──────────────────────────────────────────────────
/** A generated study set that the user hasn't saved to the database yet. */
interface PendingDeck {
  cards: Flashcard[];
  title: string;
  summary: string;
  sourceType: string;
}

const DRAFT_KEY = "quiztime:pending-deck";

function loadDraft(): PendingDeck | null {
  if (typeof window === "undefined") return null; // SSR
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (
      d &&
      Array.isArray(d.cards) &&
      d.cards.length > 0 &&
      typeof d.title === "string" &&
      d.title
    ) {
      return d as PendingDeck;
    }
  } catch {
    // Corrupted draft — ignore it.
  }
  return null;
}

function persistDraft(draft: PendingDeck | null) {
  try {
    if (draft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage full or blocked — non-fatal, the deck just won't survive reloads.
  }
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
  const [deckKey, setDeckKey] = useState(0);

  // Check if the AI key is configured via the lightweight /api/config
  // endpoint. (The old probe — an empty POST to /api/scan — always got
  // rejected as "No file or text provided" before the route ever looked
  // at the key, which is why the setup screen was unreachable.)
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => setHasApiKey(Boolean(data.hasApiKey)))
      .catch(() => {});
  }, []);

  // ── Draft deck (generated but not saved yet) ──────────────────────────────
  // Lazy initializer: restored from localStorage on first client render.
  const [draft, setDraft] = useState<PendingDeck | null>(() => loadDraft());

  const handleCardsReady = (cards: Flashcard[], title: string, summary: string, sourceType: string) => {
    setPendingCards(cards);
    setPendingTitle(title);
    setPendingSummary(summary);
    setPendingSourceType(sourceType);
    setActiveSessionId(null);
    setDeckKey((k) => k + 1);
    setTab("quiz");

    // Keep the deck safe if the user leaves before tapping Save.
    const deck: PendingDeck = { cards, title, summary, sourceType };
    setDraft(deck);
    persistDraft(deck);
  };

  const resumeDraft = () => {
    if (!draft) return;
    setPendingCards(draft.cards);
    setPendingTitle(draft.title);
    setPendingSummary(draft.summary);
    setPendingSourceType(draft.sourceType);
    setActiveSessionId(null);
    setDeckKey((k) => k + 1);
    setTab("quiz");
  };

  const discardDraft = () => {
    setDraft(null);
    persistDraft(null);
    showToast("Draft discarded", "🗑️");
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
    // Deck is in the database now — the draft has served its purpose.
    setDraft(null);
    persistDraft(null);
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
      setDeckKey((k) => k + 1);
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
          key={deckKey}
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
      return (
        <>
          {draft && !pendingCards && (
            <div
              className="animate-fade-in"
              style={{
                margin: "12px 16px 0",
                background: "#fffbeb",
                border: "1.5px solid #fde68a",
                borderRadius: 16,
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 22 }}>💾</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Unsaved study set: {draft.title}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                  {draft.cards.length} cards kept safe — resume or discard
                </p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={resumeDraft} style={{ flexShrink: 0 }}>
                Resume
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={discardDraft}
                style={{ flexShrink: 0, color: "#f43f5e", padding: "6px" }}
                aria-label="Discard draft"
              >
                <Icons.Delete />
              </button>
            </div>
          )}
          <UploadPage onCardsReady={handleCardsReady} />
        </>
      );
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
        background: "rgba(224, 242, 254, 0.78)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(147, 197, 253, 0.7)",
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
