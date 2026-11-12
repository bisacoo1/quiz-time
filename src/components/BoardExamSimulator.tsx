"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  LayoutGrid,
  RefreshCw,
  X as XIcon,
  Zap,
} from "lucide-react";

interface BoardExamQuestion {
  id: number;
  subjectCode: string;
  subjectName: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  difficulty: "easy" | "medium" | "hard";
  year?: number;
  session?: string;
}

interface BoardExamConfig {
  examCode: string;
  examName: string;
  totalQuestions: number;
  totalMinutes: number;
  subjectBreakdown: { subjectCode: string; subjectName: string; questionCount: number }[];
}

interface ExamAnswer {
  questionId: number;
  chosenIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
  subjectCode: string;
  timeSpentSeconds: number;
  flagged: boolean;
}

interface ExamSession {
  config: BoardExamConfig;
  questions: BoardExamQuestion[];
  answers: ExamAnswer[];
  currentIndex: number;
  startTime: number;
  timeRemaining: number;
  isComplete: boolean;
  isPaused: boolean;
}

const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  GENED: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  PROFED: { bg: "#f3e8ff", text: "#6d28d9", border: "#c084fc" },
  MAJOR: { bg: "#fce7f3", text: "#be185d", border: "#f9a8d4" },
  NURS1: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  NURS2: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  NURS3: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  NURS4: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  NURS5: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  MATH: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  SURV: { bg: "#e0e7ff", text: "#3730a3", border: "#a5b4fc" },
  HYDRO: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  STRUCT: { bg: "#fce7f3", text: "#be185d", border: "#f9a8d4" },
  TRANS: { bg: "#f3e8ff", text: "#6d28d9", border: "#c084fc" },
  ENV: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  CLINCHEM: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  HEMATO: { bg: "#e0e7ff", text: "#3730a3", border: "#a5b4fc" },
  MICRO: { bg: "#fce7f3", text: "#be185d", border: "#f9a8d4" },
  IMMUNO: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  BLOODBANK: { bg: "#f3e8ff", text: "#6d28d9", border: "#c084fc" },
  PARASITO: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  HISTO: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  RADPHYS: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  RADPROT: { bg: "#e0e7ff", text: "#3730a3", border: "#a5b4fc" },
  RADPOS: { bg: "#fce7f3", text: "#be185d", border: "#f9a8d4" },
  RADPATH: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  RADQC: { bg: "#f3e8ff", text: "#6d28d9", border: "#c084fc" },
  PATIENT: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  CRIM1: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  CRIM2: { bg: "#e0e7ff", text: "#3730a3", border: "#a5b4fc" },
  CRIM3: { bg: "#fce7f3", text: "#be185d", border: "#f9a8d4" },
  CRIM4: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  CRIM5: { bg: "#f3e8ff", text: "#6d28d9", border: "#c084fc" },
  CRIM6: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  FINACC: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  ADVACC: { bg: "#e0e7ff", text: "#3730a3", border: "#a5b4fc" },
  AUDIT: { bg: "#fce7f3", text: "#be185d", border: "#f9a8d4" },
  MANCON: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  TAX: { bg: "#f3e8ff", text: "#6d28d9", border: "#c084fc" },
  REG: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
};

function getSubjectColor(subjectCode: string) {
  return SUBJECT_COLORS[subjectCode] || { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTimeShort(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function computeSubjectResults(session: ExamSession) {
  const map = new Map<string, { correct: number; total: number; subjectName: string }>();
  for (let i = 0; i < session.answers.length; i++) {
    const ans = session.answers[i];
    const q = session.questions[i];
    if (!map.has(ans.subjectCode)) {
      map.set(ans.subjectCode, { correct: 0, total: 0, subjectName: q.subjectName });
    }
    const sr = map.get(ans.subjectCode)!;
    sr.total++;
    if (ans.isCorrect) sr.correct++;
  }
  return Array.from(map.entries()).map(([subjectCode, data]) => ({
    subjectCode,
    subjectName: data.subjectName,
    correct: data.correct,
    total: data.total,
    score: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
  }));
}

export function BoardExamSimulator({
  examCode,
  examName,
  subjectCode,
  mode = "full",
  onExit,
}: {
  examCode: string;
  examName: string;
  subjectCode?: string | null;
  mode?: "full" | "drill";
  onExit?: () => void;
}) {
  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNavigation, setShowNavigation] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartTimeRef = useRef<number>(0);
  const completedPostedRef = useRef(false);

  useEffect(() => {
    questionStartTimeRef.current = Date.now();
    let cancelled = false;
    const fetchExam = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ examCode });
        if (subjectCode) params.set("subjectCode", subjectCode);
        if (mode === "drill") params.set("limit", "20");
        const res = await fetch(`/api/board-exam/questions?${params.toString()}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!Array.isArray(data.questions) || data.questions.length === 0) {
          throw new Error("No questions available for this selection yet.");
        }

        const questions = data.questions as BoardExamQuestion[];
        const subjectMap = new Map<string, { subjectCode: string; subjectName: string; questionCount: number }>();
        for (const q of questions) {
          if (!subjectMap.has(q.subjectCode)) {
            subjectMap.set(q.subjectCode, { subjectCode: q.subjectCode, subjectName: q.subjectName, questionCount: 0 });
          }
          subjectMap.get(q.subjectCode)!.questionCount++;
        }
        const totalMinutes = mode === "drill"
          ? Math.max(20, Math.round((data.totalMinutes || 240) * (questions.length / Math.max(1, data.totalQuestions || questions.length))))
          : (data.totalMinutes || 240);

        const initialSession: ExamSession = {
          config: {
            examCode,
            examName: mode === "drill" ? `${examName} · Weak-Area Drill` : examName,
            totalQuestions: questions.length,
            totalMinutes,
            subjectBreakdown: Array.from(subjectMap.values()),
          },
          questions,
          answers: questions.map((q) => ({
            questionId: q.id,
            chosenIndex: null,
            correctIndex: q.correctIndex,
            isCorrect: false,
            subjectCode: q.subjectCode,
            timeSpentSeconds: 0,
            flagged: false,
          })),
          currentIndex: 0,
          startTime: Date.now(),
          timeRemaining: totalMinutes * 60,
          isComplete: false,
          isPaused: false,
        };
        if (cancelled) return;
        completedPostedRef.current = false;
        setSession(initialSession);
        questionStartTimeRef.current = Date.now();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load exam");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchExam();
    return () => { cancelled = true; };
  }, [examCode, examName, mode, subjectCode]);

  useEffect(() => {
    if (!session || session.isComplete || session.isPaused) return;
    timerRef.current = setInterval(() => {
      setSession((prev) => {
        if (!prev || prev.isComplete || prev.isPaused) return prev;
        const newTime = prev.timeRemaining - 1;
        if (newTime <= 0) return { ...prev, timeRemaining: 0, isComplete: true };
        return { ...prev, timeRemaining: newTime };
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    questionStartTimeRef.current = Date.now();
  }, [session?.currentIndex, session]);

  const recordTimeForCurrent = useCallback((prev: ExamSession): ExamSession => {
    const idx = prev.currentIndex;
    const spent = Math.max(0, Math.floor((Date.now() - questionStartTimeRef.current) / 1000));
    const answers = [...prev.answers];
    answers[idx] = { ...answers[idx], timeSpentSeconds: answers[idx].timeSpentSeconds + spent };
    questionStartTimeRef.current = Date.now();
    return { ...prev, answers };
  }, []);

  const handleAnswer = useCallback((optionIndex: number) => {
    setSession((prev) => {
      if (!prev || prev.isComplete) return prev;
      const q = prev.questions[prev.currentIndex];
      const answers = [...prev.answers];
      answers[prev.currentIndex] = { ...answers[prev.currentIndex], chosenIndex: optionIndex, correctIndex: q.correctIndex, isCorrect: optionIndex === q.correctIndex };
      return { ...prev, answers };
    });
  }, []);

  const handleFlag = useCallback(() => {
    setSession((prev) => {
      if (!prev || prev.isComplete) return prev;
      const answers = [...prev.answers];
      answers[prev.currentIndex] = { ...answers[prev.currentIndex], flagged: !answers[prev.currentIndex].flagged };
      return { ...prev, answers };
    });
  }, []);

  const handleJumpTo = useCallback((index: number) => {
    setSession((prev) => {
      if (!prev || index < 0 || index >= prev.questions.length) return prev;
      const updated = recordTimeForCurrent(prev);
      return { ...updated, currentIndex: index };
    });
    setShowNavigation(false);
  }, [recordTimeForCurrent]);

  const handleNext = useCallback(() => {
    setSession((prev) => {
      if (!prev || prev.currentIndex >= prev.questions.length - 1) return prev;
      const updated = recordTimeForCurrent(prev);
      return { ...updated, currentIndex: updated.currentIndex + 1 };
    });
  }, [recordTimeForCurrent]);

  const handlePrev = useCallback(() => {
    setSession((prev) => {
      if (!prev || prev.currentIndex <= 0) return prev;
      const updated = recordTimeForCurrent(prev);
      return { ...updated, currentIndex: updated.currentIndex - 1 };
    });
  }, [recordTimeForCurrent]);

  const handlePause = useCallback(() => {
    setSession((prev) => (prev ? recordTimeForCurrent({ ...prev, isPaused: true }) : prev));
    setShowPauseMenu(true);
  }, [recordTimeForCurrent]);

  const handleResume = useCallback(() => {
    questionStartTimeRef.current = Date.now();
    setSession((prev) => (prev ? { ...prev, isPaused: false } : prev));
    setShowPauseMenu(false);
  }, []);

  const handleSubmit = useCallback(() => {
    setSession((prev) => {
      if (!prev || prev.isComplete) return prev;
      const unanswered = prev.answers.filter((a) => a.chosenIndex === null).length;
      if (unanswered > 0 && !window.confirm(`${unanswered} question(s) unanswered. Submit anyway?`)) return prev;
      const updated = recordTimeForCurrent(prev);
      return { ...updated, isComplete: true, isPaused: false, timeRemaining: Math.max(0, updated.timeRemaining) };
    });
  }, [recordTimeForCurrent]);

  const handleExit = useCallback(() => {
    if (onExit) onExit();
    else window.location.href = "/board-readiness";
  }, [onExit]);

  const completedSession = session?.isComplete ? session : null;
  const subjectResults = useMemo(() => (completedSession ? computeSubjectResults(completedSession) : []), [completedSession]);

  useEffect(() => {
    if (!completedSession || completedPostedRef.current) return;
    completedPostedRef.current = true;
    const correctCount = completedSession.answers.filter((a) => a.isCorrect).length;
    const score = Math.round((correctCount / Math.max(1, completedSession.questions.length)) * 100);
    const passed = score >= 75;
    const timeUsedMinutes = Math.max(1, Math.round((completedSession.config.totalMinutes * 60 - completedSession.timeRemaining) / 60));
    setSaveState("saving");
    void fetch("/api/board-exam/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examCode,
        config: {
          totalQuestions: completedSession.config.totalQuestions,
          totalMinutes: completedSession.config.totalMinutes,
          subjectBreakdown: completedSession.config.subjectBreakdown.map((s) => ({ subjectCode: s.subjectCode, questionCount: s.questionCount })),
        },
        score,
        passed,
        timeUsedMinutes,
        subjectResults: subjectResults.map((s) => ({ subjectCode: s.subjectCode, correct: s.correct, total: s.total, score: s.score })),
        answers: completedSession.answers.map((a) => ({ questionId: a.questionId, chosenIndex: a.chosenIndex, correctIndex: a.correctIndex, isCorrect: a.isCorrect, subjectCode: a.subjectCode, timeSpentSeconds: a.timeSpentSeconds })),
        flaggedQuestions: completedSession.answers.map((a, i) => (a.flagged ? completedSession.questions[i].id : null)).filter((n): n is number => typeof n === "number"),
        startedAt: new Date(completedSession.startTime).toISOString(),
      }),
    }).then(async (res) => {
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to save");
      setSaveState("saved");
    }).catch(() => setSaveState("error"));
  }, [completedSession, examCode, subjectResults]);

  if (loading) {
    return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16 }}><div className="spinner" style={{ width: 48, height: 48, borderWidth: 4 }} /><p style={{ color: "var(--text-muted)" }}>Loading {examName}...</p></div>;
  }
  if (error) {
    return <div style={{ padding: 32, textAlign: "center", background: "#fee2e2", borderRadius: 16, border: "1px solid #fecaca", margin: 20 }}><AlertTriangle size={48} style={{ color: "#dc2626", marginBottom: 16 }} /><h3 style={{ margin: "0 0 8px", color: "#991b1b" }}>Could not load exam</h3><p style={{ margin: "0 0 20px", color: "#b91c1c" }}>{error}</p><div style={{ display: "flex", gap: 10, justifyContent: "center" }}><button className="btn btn-secondary" onClick={handleExit}>Back</button><button className="btn btn-primary" onClick={() => window.location.reload()}><RefreshCw size={16} /> Retry</button></div></div>;
  }
  if (!session) return null;

  if (session.isComplete) {
    const correctCount = session.answers.filter((a) => a.isCorrect).length;
    const totalCount = session.questions.length;
    const scorePercent = Math.round((correctCount / Math.max(1, totalCount)) * 100);
    const passed = scorePercent >= 75;
    const timeUsed = session.config.totalMinutes * 60 - session.timeRemaining;
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", padding: 20 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="glass-card" style={{ padding: 24, borderRadius: 16, textAlign: "center" }}>
            <div style={{ fontSize: 44, fontWeight: 900, color: passed ? "#166534" : "#991b1b" }}>{scorePercent}%</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: passed ? "#166534" : "#991b1b", marginTop: 4 }}>{passed ? "PASSED" : "BELOW PASSING (75%)"}</div>
            <p style={{ margin: "8px 0 0", color: "var(--text-muted)" }}>{correctCount} / {totalCount} correct · Time used {formatTimeShort(timeUsed)}</p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{saveState === "saving" ? "Saving attempt..." : saveState === "saved" ? "Attempt saved to your readiness history." : saveState === "error" ? "Could not save attempt (you can still review answers)." : ""}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowReview(true)}><BookOpen size={16} /> Review answers</button>
              <button className="btn btn-secondary" onClick={() => window.location.reload()}><RefreshCw size={16} /> Retake</button>
              <button className="btn btn-primary" onClick={handleExit}>Back to readiness</button>
            </div>
          </div>
          <div className="glass-card" style={{ padding: 20, borderRadius: 16 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>Subject breakdown</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {subjectResults.map((sr) => {
                const color = getSubjectColor(sr.subjectCode);
                return (
                  <div key={sr.subjectCode} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 36, borderRadius: 10, background: color.bg, color: color.text, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11 }}>{sr.subjectCode}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700 }}>{sr.subjectName}</span>
                        <span style={{ fontWeight: 700, color: color.text }}>{sr.score}% ({sr.correct}/{sr.total})</span>
                      </div>
                      <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${sr.score}%`, height: "100%", background: color.text }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {showReview && (
            <div className="glass-card" style={{ padding: 20, borderRadius: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Answer review</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowReview(false)}><XIcon size={18} /></button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {session.questions.map((q, i) => {
                  const a = session.answers[i];
                  const bg = a.chosenIndex === null ? "#e2e8f0" : a.isCorrect ? "#dcfce7" : "#fee2e2";
                  const border = a.chosenIndex === null ? "#94a3b8" : a.isCorrect ? "#86efac" : "#fca5a5";
                  return <button key={q.id} onClick={() => setReviewIndex(i)} style={{ width: 34, height: 34, borderRadius: 8, border: `2px solid ${i === reviewIndex ? "#3b82f6" : border}`, background: bg, fontWeight: 700, fontSize: 12 }}>{i + 1}</button>;
                })}
              </div>
              {(() => {
                const q = session.questions[reviewIndex];
                const a = session.answers[reviewIndex];
                const c = getSubjectColor(q.subjectCode);
                return (
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <span style={{ padding: "4px 8px", borderRadius: 8, background: c.bg, color: c.text, fontSize: 11, fontWeight: 800 }}>{q.subjectCode}</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{q.subjectName}</span>
                      {a.flagged && <span style={{ fontSize: 12, color: "#92400e", fontWeight: 700 }}>Flagged</span>}
                    </div>
                    <p style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, lineHeight: 1.5 }}>{q.question}</p>
                    <div style={{ display: "grid", gap: 8 }}>
                      {q.options.map((opt, idx) => {
                        const chosen = a.chosenIndex === idx;
                        const correct = q.correctIndex === idx;
                        let bg = "#fff", border = "#e2e8f0", color = "var(--text)";
                        if (correct) { bg = "#dcfce7"; border = "#86efac"; color = "#166534"; }
                        else if (chosen) { bg = "#fee2e2"; border = "#fca5a5"; color = "#991b1b"; }
                        return <div key={idx} style={{ padding: "10px 12px", borderRadius: 10, border: `2px solid ${border}`, background: bg, color }}><strong>{String.fromCharCode(65 + idx)}.</strong> {opt}{correct ? " (Correct)" : chosen ? " (Your answer)" : ""}</div>;
                      })}
                    </div>
                    <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>Rationale</p>
                      <p style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.55 }}>{q.explanation || "No rationale provided for this item yet."}</p>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
                      <button className="btn btn-secondary btn-sm" disabled={reviewIndex === 0} onClick={() => setReviewIndex((i) => Math.max(0, i - 1))}><ChevronLeft size={16} /> Previous</button>
                      <button className="btn btn-secondary btn-sm" disabled={reviewIndex === session.questions.length - 1} onClick={() => setReviewIndex((i) => Math.min(session.questions.length - 1, i + 1))}>Next <ChevronRight size={16} /></button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentQuestion = session.questions[session.currentIndex];
  const currentAnswer = session.answers[session.currentIndex];
  const answeredCount = session.answers.filter((a) => a.chosenIndex !== null).length;
  const flaggedCount = session.answers.filter((a) => a.flagged).length;
  const progress = ((session.currentIndex + 1) / session.questions.length) * 100;
  const subjectColor = getSubjectColor(currentQuestion.subjectCode);
  const isCriticalTime = session.timeRemaining <= 300;
  const isWarningTime = session.timeRemaining <= 600;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border-color)", gap: 12, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 200 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleExit} style={{ padding: 8 }} aria-label="Exit exam"><XIcon size={18} /></button>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>{session.config.examName}</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>Q {session.currentIndex + 1}/{session.questions.length} · {answeredCount} answered · {flaggedCount} flagged</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 12, background: isCriticalTime ? "#fee2e2" : isWarningTime ? "#fffbeb" : "#f0f9ff", border: `2px solid ${isCriticalTime ? "#ef4444" : isWarningTime ? "#f59e0b" : "#3b82f6"}` }}>
          <Clock size={18} style={{ color: isCriticalTime ? "#dc2626" : isWarningTime ? "#d97706" : "#2563eb" }} />
          <span style={{ fontSize: 18, fontWeight: 900, fontFamily: "monospace", color: isCriticalTime ? "#dc2626" : isWarningTime ? "#d97706" : "#1e40af" }}>{formatTime(session.timeRemaining)}</span>
          {session.isPaused && <span style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>PAUSED</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowNavigation(true)}><LayoutGrid size={16} /> Navigator</button>
          {!session.isPaused && <button className="btn btn-ghost btn-sm" onClick={handlePause}><Zap size={16} /> Pause</button>}
        </div>
      </header>
      <div style={{ height: 4, background: "#e2e8f0" }}><div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #3b82f6, #7c3aed)" }} /></div>
      <main style={{ flex: 1, overflow: "auto", padding: 20 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: subjectColor.bg, border: `1px solid ${subjectColor.border}`, borderRadius: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: subjectColor.text, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11 }}>{currentQuestion.subjectCode}</div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: subjectColor.text }}>{currentQuestion.subjectName}</p>
              <p style={{ margin: 0, fontSize: 11, color: subjectColor.text, opacity: 0.85 }}>Difficulty: {currentQuestion.difficulty}</p>
            </div>
          </div>
          <div className="glass-card" style={{ padding: 22, borderRadius: 16 }}>
            <p style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 700, lineHeight: 1.5 }}>{currentQuestion.question}</p>
            <div style={{ display: "grid", gap: 10 }}>
              {currentQuestion.options.map((option, idx) => {
                const selected = currentAnswer.chosenIndex === idx;
                return (
                  <button key={idx} onClick={() => handleAnswer(idx)} style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "14px 16px", borderRadius: 12, border: `2px solid ${selected ? "#3b82f6" : "var(--border-color)"}`, background: selected ? "#eff6ff" : "#fff", cursor: "pointer" }}>
                    <span style={{ width: 26, height: 26, borderRadius: "50%", border: `2px solid ${selected ? "#3b82f6" : "#cbd5e1"}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: selected ? "#1d4ed8" : "#64748b", flexShrink: 0 }}>{String.fromCharCode(65 + idx)}</span>
                    <span style={{ flex: 1 }}>{option}</span>
                    {selected && <Check size={18} color="#2563eb" />}
                  </button>
                );
              })}
            </div>
            <button onClick={handleFlag} style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, border: currentAnswer.flagged ? "1px solid #fcd34d" : "1px solid var(--border-color)", background: currentAnswer.flagged ? "#fffbeb" : "transparent", color: currentAnswer.flagged ? "#92400e" : "var(--text-muted)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Flag size={15} /> {currentAnswer.flagged ? "Flagged for review" : "Flag question"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button className="btn btn-secondary" onClick={handlePrev} disabled={session.currentIndex === 0} style={{ flex: 1 }}><ChevronLeft size={18} /> Previous</button>
            {session.currentIndex === session.questions.length - 1 ? (
              <button className="btn btn-primary btn-lg" onClick={handleSubmit} style={{ flex: 2 }}><Check size={18} /> Submit exam</button>
            ) : (
              <button className="btn btn-primary" onClick={handleNext} style={{ flex: 1 }}>Next <ChevronRight size={18} /></button>
            )}
          </div>
        </div>
      </main>
      {showNavigation && (
        <div onClick={() => setShowNavigation(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 200, display: "flex", alignItems: "flex-end", padding: 20 }}>
          <div className="glass-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "75vh", overflow: "auto", borderRadius: 20, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Question navigator</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNavigation(false)}><XIcon size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(42px, 1fr))", gap: 8 }}>
              {session.questions.map((q, i) => {
                const a = session.answers[i];
                const c = getSubjectColor(q.subjectCode);
                const isCurrent = i === session.currentIndex;
                let bg = "#fff", border = c.border;
                if (isCurrent) { bg = c.bg; border = c.text; }
                else if (a.flagged) { bg = "#fffbeb"; border = "#fcd34d"; }
                else if (a.chosenIndex !== null) { bg = "#dbeafe"; border = "#93c5fd"; }
                return <button key={q.id} onClick={() => handleJumpTo(i)} style={{ aspectRatio: "1", borderRadius: 10, border: `2px solid ${border}`, background: bg, fontWeight: 800, fontSize: 12, position: "relative" }}>{i + 1}{a.flagged && <Flag size={10} style={{ position: "absolute", top: 2, right: 2, color: "#92400e" }} />}</button>;
              })}
            </div>
          </div>
        </div>
      )}
      {showPauseMenu && (
        <div onClick={handleResume} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="glass-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, padding: 24, borderRadius: 20, textAlign: "center" }}>
            <Zap size={44} style={{ color: "#f59e0b", marginBottom: 10 }} />
            <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>Exam paused</h2>
            <p style={{ margin: "0 0 18px", color: "var(--text-muted)" }}>Timer is stopped. Resume when ready.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleExit}>Exit</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleResume}><Zap size={16} /> Resume</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
