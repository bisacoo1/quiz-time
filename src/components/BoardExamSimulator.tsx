"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Flag,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  LayoutGrid,
  Zap,
  Trophy,
  BookOpen,
  Target,
  Menu,
  X as XIcon,
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

function ResultsScreen({ session, handleExit }: { session: ExamSession; handleExit: () => void }) {
  const correctCount = session.answers.filter((a) => a.isCorrect).length;
  const totalCount = session.questions.length;
  const scorePercent = Math.round((correctCount / totalCount) * 100);
  const passed = scorePercent >= 75;
  const timeUsedMinutes = Math.round((Date.now() - session.startTime) / 60000);

  const subjectResults = useMemo(() => {
    const map = new Map<string, { correct: number; total: number; subjectName: string }>();
    for (let i = 0; i < session.answers.length; i++) {
      const ans = session.answers[i];
      const q = session.questions[i];
      const key = ans.subjectCode;
      if (!map.has(key)) {
        map.set(key, { correct: 0, total: 0, subjectName: q.subjectName });
      }
      const sr = map.get(key)!;
      sr.total++;
      if (ans.isCorrect) sr.correct++;
    }
    return Array.from(map.entries()).map(([subjectCode, data]) => ({
      subjectCode,
      correct: data.correct,
      total: data.total,
      score: Math.round((data.correct / data.total) * 100),
      subjectName: data.subjectName,
    }));
  }, [session]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 24 }}>
      <div
        style={{
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: passed ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #ef4444, #dc2626)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
        }}
      >
        <span style={{ fontSize: 42, fontWeight: 900, color: "white" }}>{scorePercent}%</span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: 600, textTransform: "uppercase" }}>
          {passed ? "PASSED" : "FAILED"}
        </span>
      </div>

      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 800 }}>
          {passed ? "Congratulations!" : "Keep Studying!"}
        </h2>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 15 }}>
          You scored <strong>{correctCount}</strong> out of <strong>{totalCount}</strong> in <strong>{formatTimeShort(Math.round((Date.now() - session.startTime) / 1000))}</strong>
        </p>
      </div>

      <div className="glass-card" style={{ width: "100%", maxWidth: 500, padding: 20, borderRadius: 16 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
          <Target size={20} style={{ color: "var(--accent-dark)" }} />
          Subject Breakdown
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {session.config.subjectBreakdown.map((sb) => {
            const sr = subjectResults.find(r => r.subjectCode === sb.subjectCode);
            const correct = sr?.correct || 0;
            const total = sr?.total || 0;
            const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
            const color = getSubjectColor(sb.subjectCode);
            return (
              <div key={sb.subjectCode} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: color.bg, color: color.text, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
                  {sb.subjectCode}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{sb.subjectName}</span>
                    <span style={{ color: color.text, fontWeight: 700 }}>{pct}% ({correct}/{total})</span>
                  </div>
                  <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${color.text}, ${color.border})`, borderRadius: 3 }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button className="btn btn-primary btn-lg" onClick={() => window.location.reload()}>
          <RefreshCw size={18} /> Retake Exam
        </button>
        <button className="btn btn-secondary btn-lg" onClick={handleExit}>
          <BookOpen size={18} /> Review Answers
        </button>
      </div>
    </div>
  );
}

function QuestionScreen({
  session,
  currentQuestion,
  currentAnswer,
  subjectColor,
  answeredCount,
  handleAnswer,
  handleFlag,
  handleNext,
  handlePrev,
  handleSubmit,
}: {
  session: ExamSession;
  currentQuestion: BoardExamQuestion;
  currentAnswer: ExamAnswer;
  subjectColor: { bg: string; text: string; border: string };
  answeredCount: number;
  handleAnswer: (optionIndex: number) => void;
  handleFlag: () => void;
  handleNext: () => void;
  handlePrev: () => void;
  handleSubmit: () => void;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 800, margin: "0 auto", width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          background: subjectColor.bg,
          border: `1px solid ${subjectColor.border}`,
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ width: 32, height: 32, borderRadius: 8, background: subjectColor.text, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, flexShrink: 0 }}>
          {currentQuestion.subjectCode}
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: subjectColor.text }}>{currentQuestion.subjectName}</p>
          <p style={{ margin: 0, fontSize: 11, color: subjectColor.text, opacity: 0.8 }}>Weight: {session.config.subjectBreakdown.find(s => s.subjectCode === currentQuestion.subjectCode)?.questionCount || "?"} questions</p>
        </div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 11, color: subjectColor.text, opacity: 0.7 }}>Difficulty: {currentQuestion.difficulty}</p>
          {currentQuestion.year && (
            <p style={{ margin: 0, fontSize: 11, color: subjectColor.text, opacity: 0.7 }}>{currentQuestion.year} {currentQuestion.session}</p>
          )}
        </div>
      </div>

      <div className="glass-card" style={{ flex: 1, padding: 24, borderRadius: 16, display: "flex", flexDirection: "column" }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700, lineHeight: 1.5, color: "var(--text)" }}>
            {currentQuestion.question}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
          {currentQuestion.options.map((option, idx) => {
            const isSelected = currentAnswer.chosenIndex === idx;
            const isCorrect = idx === currentQuestion.correctIndex;
            const showResult = session.isComplete || session.isPaused;

            let bg = "white";
            let border = "var(--border-color)";
            let textColor = "var(--text)";

            if (showResult) {
              if (isCorrect) {
                bg = "#dcfce7";
                border = "#86efac";
                textColor = "#166534";
              } else if (isSelected && !isCorrect) {
                bg = "#fee2e2";
                border = "#fca5a5";
                textColor = "#dc2626";
              }
            } else if (isSelected) {
              bg = "#eff6ff";
              border = "#3b82f6";
              textColor = "#1d4ed8";
            }

            return (
              <button
                key={idx}
                onClick={() => !session.isComplete && !session.isPaused && handleAnswer(idx)}
                disabled={session.isComplete || session.isPaused}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "16px 20px",
                  borderRadius: 12,
                  border: `2px solid ${border}`,
                  background: bg,
                  color: textColor,
                  textAlign: "left",
                  fontSize: 15,
                  fontWeight: isSelected ? 700 : 500,
                  lineHeight: 1.4,
                  transition: "all 0.15s ease",
                  cursor: session.isComplete || session.isPaused ? "default" : "pointer",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: `2px solid ${isSelected ? border : "var(--border-color)"}`,
                    background: isSelected ? bg : "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isSelected && (
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: showResult ? (isCorrect ? "#166534" : "#dc2626") : "#3b82f6",
                      }}
                    />
                  )}
                </div>
                <span style={{ flex: 1 }}>{option}</span>
                {showResult && isCorrect && <Check size={20} style={{ color: "#166534", flexShrink: 0 }} />}
                {showResult && isSelected && !isCorrect && <X size={20} style={{ color: "#dc2626", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleFlag}
          disabled={session.isComplete}
          style={{
            marginTop: 16,
            padding: "10px 16px",
            borderRadius: 10,
            border: currentAnswer.flagged ? "1px solid #fcd34d" : "1px solid var(--border-color)",
            background: currentAnswer.flagged ? "#fffbeb" : "transparent",
            color: currentAnswer.flagged ? "#92400e" : "var(--text-muted)",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: session.isComplete ? "default" : "pointer",
          }}
        >
          <Flag size={16} />
          {currentAnswer.flagged ? "Flagged for Review" : "Flag for Review"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-color)" }}>
        <button
          className="btn btn-secondary"
          onClick={handlePrev}
          disabled={session.currentIndex === 0 || session.isComplete}
          style={{ flex: 1 }}
        >
          <ChevronLeft size={18} /> Previous
        </button>
        {session.currentIndex === session.questions.length - 1 ? (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSubmit}
            disabled={session.isComplete}
            style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <Check size={18} />
            Submit Exam
            {answeredCount < session.questions.length && <AlertTriangle size={16} style={{ color: "#f59e0b" }} />}
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={handleNext}
            disabled={session.isComplete}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            Next <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

export function BoardExamSimulator({
  examCode,
  examName,
  course,
  onComplete,
  onExit,
}: {
  examCode: string;
  examName: string;
  course: string;
  onComplete?: (result: {
    score: number;
    passed: boolean;
    subjectResults: { subjectCode: string; correct: number; total: number; score: number }[];
    answers: ExamAnswer[];
    timeUsedMinutes: number;
  }) => void;
  onExit?: () => void;
}) {
  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNavigation, setShowNavigation] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [warningShown, setWarningShown] = useState<Record<string, boolean>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const fetchExam = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/board-exam/questions?examCode=${examCode}`, { cache: "no-store" });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();

        const subjectMap = new Map<string, { subjectCode: string; subjectName: string; questionCount: number }>();
        for (const q of data.questions) {
          const key = q.subjectCode;
          if (!subjectMap.has(key)) {
            subjectMap.set(key, { subjectCode: q.subjectCode, subjectName: q.subjectName, questionCount: 0 });
          }
          subjectMap.get(key)!.questionCount++;
        }

        const subjectBreakdown = Array.from(subjectMap.values());

        const config: BoardExamConfig = {
          examCode,
          examName,
          totalQuestions: data.questions.length,
          totalMinutes: data.totalMinutes || 240,
          subjectBreakdown,
        };

        const shuffled = [...data.questions].sort(() => Math.random() - 0.5);

        const initialSession: ExamSession = {
          config,
          questions: shuffled,
          answers: shuffled.map((q) => ({
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
          timeRemaining: config.totalMinutes * 60,
          isComplete: false,
          isPaused: false,
        };

        setSession(initialSession);
        questionStartTimeRef.current = Date.now();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load exam");
      } finally {
        setLoading(false);
      }
    };

    fetchExam();
  }, [examCode]);

  useEffect(() => {
    if (!session || session.isComplete || session.isPaused) return;

    timerRef.current = setInterval(() => {
      setSession((prev) => {
        if (!prev || prev.isComplete || prev.isPaused) return prev;
        const newTime = prev.timeRemaining - 1;
        if (newTime <= 0) {
          return { ...prev, timeRemaining: 0, isComplete: true };
        }
        return { ...prev, timeRemaining: newTime };
      });
    }, 1000);

    const warnings = [3600, 1800, 600, 300, 60];
    for (const w of warnings) {
      if (session.timeRemaining === w && !warningShown[w]) {
        setWarningShown((prev) => ({ ...prev, [w]: true }));
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session?.timeRemaining, session?.isComplete, session?.isPaused, warningShown]);

  useEffect(() => {
    if (!session) return;
    questionStartTimeRef.current = Date.now();
  }, [session?.currentIndex]);

  const handleAnswer = useCallback((optionIndex: number) => {
    if (!session || session.isComplete) return;

    const currentQuestion = session.questions[session.currentIndex];
    const timeSpent = Math.floor((Date.now() - questionStartTimeRef.current) / 1000);

    setSession((prev) => {
      if (!prev) return prev;
      const newAnswers = [...prev.answers];
      newAnswers[prev.currentIndex] = {
        ...newAnswers[prev.currentIndex],
        chosenIndex: optionIndex,
        isCorrect: optionIndex === currentQuestion.correctIndex,
        timeSpentSeconds: timeSpent,
      };
      return { ...prev, answers: newAnswers };
    });
  }, [session]);

  const handleFlag = useCallback(() => {
    if (!session) return;
    setSession((prev) => {
      if (!prev) return prev;
      const newAnswers = [...prev.answers];
      newAnswers[prev.currentIndex] = {
        ...newAnswers[prev.currentIndex],
        flagged: !newAnswers[prev.currentIndex].flagged,
      };
      return { ...prev, answers: newAnswers };
    });
  }, [session]);

  const handleNext = useCallback(() => {
    if (!session) return;
    if (session.currentIndex < session.questions.length - 1) {
      setSession((prev) => prev ? { ...prev, currentIndex: prev.currentIndex + 1 } : prev);
    }
  }, [session]);

  const handlePrev = useCallback(() => {
    if (!session) return;
    if (session.currentIndex > 0) {
      setSession((prev) => prev ? { ...prev, currentIndex: prev.currentIndex - 1 } : prev);
    }
  }, [session]);

  const handleJumpTo = useCallback((index: number) => {
    if (!session) return;
    if (index >= 0 && index < session.questions.length) {
      setSession((prev) => prev ? { ...prev, currentIndex: index } : prev);
    }
    setShowNavigation(false);
  }, [session]);

  const handlePause = useCallback(() => {
    if (!session) return;
    setSession((prev) => prev ? { ...prev, isPaused: !prev.isPaused } : prev);
    setShowPauseMenu(true);
  }, [session]);

  const handleResume = useCallback(() => {
    if (!session) return;
    setSession((prev) => prev ? { ...prev, isPaused: false } : prev);
    setShowPauseMenu(false);
  }, [session]);

  const handleSubmit = useCallback(async () => {
    if (!session) return;

    const unanswered = session.answers.filter((a) => a.chosenIndex === null).length;
    if (unanswered > 0) {
      const confirm = window.confirm(`${unanswered} question(s) unanswered. Submit anyway?`);
      if (!confirm) return;
    }

    const correct = session.answers.filter((a) => a.isCorrect).length;
    const score = Math.round((correct / session.answers.length) * 100);

    const subjectResultsMap = new Map<string, { correct: number; total: number; subjectName: string }>();
    for (let i = 0; i < session.answers.length; i++) {
      const ans = session.answers[i];
      const q = session.questions[i];
      const key = ans.subjectCode;
      if (!subjectResultsMap.has(key)) {
        subjectResultsMap.set(key, { correct: 0, total: 0, subjectName: q.subjectName });
      }
      const sr = subjectResultsMap.get(key)!;
      sr.total++;
      if (ans.isCorrect) sr.correct++;
    }

    const subjectResults = Array.from(subjectResultsMap.entries()).map(([subjectCode, data]) => ({
      subjectCode,
      correct: data.correct,
      total: data.total,
      score: Math.round((data.correct / data.total) * 100),
    }));

    const passed = score >= 75;
    const timeUsedMinutes = Math.round((Date.now() - session.startTime) / 60000);

    const finalSession = { ...session, isComplete: true, timeRemaining: 0 };
    setSession(finalSession);

    if (onComplete) {
      onComplete({
        score,
        passed,
        subjectResults,
        answers: session.answers,
        timeUsedMinutes,
      });
    }
  }, [session, onComplete]);

  const handleExit = useCallback(() => {
    if (onExit) onExit();
  }, [onExit]);

  if (loading) {
    return (
      <div className="exam-loading" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16 }}>
        <div className="spinner" style={{ width: 48, height: 48, borderWidth: 4 }} />
        <p style={{ color: "var(--text-muted)", fontSize: 16 }}>Loading {examName} simulation...</p>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Fetching curated board exam questions</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="exam-error" style={{ padding: 32, textAlign: "center", background: "#fee2e2", borderRadius: 16, border: "1px solid #fecaca" }}>
        <AlertTriangle size={48} style={{ color: "#dc2626", marginBottom: 16 }} />
        <h3 style={{ margin: "0 0 8px", color: "#991b1b" }}>Couldn't load exam</h3>
        <p style={{ margin: "0 0 20px", color: "#b91c1c" }}>{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  if (!session) return null;

  const currentQuestion = session.questions[session.currentIndex];
  const currentAnswer = session.answers[session.currentIndex];
  const progress = ((session.currentIndex + 1) / session.questions.length) * 100;
  const answeredCount = session.answers.filter((a) => a.chosenIndex !== null).length;
  const flaggedCount = session.answers.filter((a) => a.flagged).length;
  const subjectColor = getSubjectColor(currentQuestion.subjectCode);

  const isCriticalTime = session.timeRemaining <= 300;
  const isWarningTime = session.timeRemaining <= 600;

  return (
    <div className="board-exam-simulator" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border-color)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 200 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleExit} disabled={session.isComplete} style={{ padding: 8 }}>
            <XIcon size={20} />
          </button>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {examCode} Simulation
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)" }}>
              Question {session.currentIndex + 1} of {session.questions.length}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 16px",
            borderRadius: 12,
            background: isCriticalTime ? "#fee2e2" : isWarningTime ? "#fffbeb" : "#f0f9ff",
            border: `2px solid ${isCriticalTime ? "#ef4444" : isWarningTime ? "#f59e0b" : "#3b82f6"}`,
            animation: isCriticalTime ? "pulse 1s infinite" : "none",
          }}
        >
          <Clock size={20} style={{ color: isCriticalTime ? "#dc2626" : isWarningTime ? "#d97706" : "#2563eb" }} />
          <span
            style={{
              fontSize: isCriticalTime ? 20 : 18,
              fontWeight: 900,
              fontVariantNumeric: "tabular-nums",
              fontFamily: "monospace",
              color: isCriticalTime ? "#dc2626" : isWarningTime ? "#d97706" : "#1e40af",
            }}
          >
            {formatTime(session.timeRemaining)}
          </span>
          {session.isPaused && (
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#f59e0b" }}>PAUSED</span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, justifyContent: "flex-end", minWidth: 200 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowNavigation(!showNavigation)} style={{ padding: "6px 10px", borderRadius: 8, display: "flex", alignItems: "center", gap: 4 }}>
              <LayoutGrid size={16} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{answeredCount}/{session.questions.length}</span>
            </button>
            {flaggedCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNavigation(true)} style={{ padding: "6px 10px", borderRadius: 8, display: "flex", alignItems: "center", gap: 4, background: "#fffbeb", color: "#92400e" }}>
                <Flag size={16} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{flaggedCount}</span>
              </button>
            )}
          </div>
          {!session.isComplete && !session.isPaused && (
            <button className="btn btn-ghost btn-sm" onClick={handlePause} style={{ padding: "6px 12px", borderRadius: 8 }}>
              <Zap size={16} /> Pause
            </button>
          )}
        </div>
      </header>

      <div style={{ height: 4, background: "#e2e8f0", position: "sticky", top: 60, zIndex: 99 }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #3b82f6, #7c3aed)", transition: "width 0.3s ease" }} />
      </div>

      {showNavigation && (
        <div className="exam-nav-overlay" onClick={() => setShowNavigation(false)} style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", zIndex: 200, display: "flex", alignItems: "flex-end", padding: 20 }}>
          <div className="glass-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "70vh", borderRadius: 20, padding: 20, overflow: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Question Navigator</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNavigation(false)}><XIcon size={20} /></button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--text-muted)" }}>Filter by Subject</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {session.config.subjectBreakdown.map((sb) => {
                  const color = getSubjectColor(sb.subjectCode);
                  const subjectAnswered = session.questions
                    .filter((q) => q.subjectCode === sb.subjectCode)
                    .filter((q) => session.answers[session.questions.indexOf(q)].chosenIndex !== null).length;
                  return (
                    <button key={sb.subjectCode} onClick={() => { const firstIdx = session.questions.findIndex((q) => q.subjectCode === sb.subjectCode); if (firstIdx >= 0) handleJumpTo(firstIdx); }} style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${color.border}`, background: color.bg, color: color.text, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                      {sb.subjectCode}
                      <span style={{ fontSize: 11, opacity: 0.7 }}>{subjectAnswered}/{sb.questionCount}</span>
                    </button>
                  );
                })}
                <button onClick={() => handleJumpTo(0)} style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border-color)", background: "white", color: "var(--text)", fontSize: 12, fontWeight: 700 }}>All Questions</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 8 }}>
              {session.questions.map((q, i) => {
                const ans = session.answers[i];
                const color = getSubjectColor(q.subjectCode);
                const isCurrent = i === session.currentIndex;
                const isAnswered = ans.chosenIndex !== null;
                const isFlagged = ans.flagged;
                const isCorrect = ans.isCorrect;

                let bg = "white";
                let border = color.border;
                let textColor = color.text;

                if (isCurrent) { bg = color.bg; border = color.text; textColor = color.text; }
                else if (isFlagged) { bg = "#fffbeb"; border = "#fcd34d"; textColor = "#92400e"; }
                else if (isAnswered) { bg = isCorrect ? "#dcfce7" : "#fee2e2"; border = isCorrect ? "#86efac" : "#fca5a5"; textColor = isCorrect ? "#166534" : "#dc2626"; }

                return (
                  <button key={q.id} onClick={() => handleJumpTo(i)} style={{ aspectRatio: "1", borderRadius: 10, border: `2px solid ${border}`, background: bg, color: textColor, fontSize: 11, fontWeight: isCurrent ? 800 : 700, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, position: "relative" }}>
                    <span>{i + 1}</span>
                    <span style={{ fontSize: 9, opacity: 0.7 }}>{q.subjectCode}</span>
                    {isFlagged && <Flag size={10} style={{ position: "absolute", top: 2, right: 2 }} />}
                    {isCurrent && <div style={{ position: "absolute", bottom: 2, left: 0, right: 0, height: 3, background: color.text, borderRadius: "0 0 8px 8px" }} />}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-color)", display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: "var(--text-muted)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: "#dcfce7", border: "1px solid #86efac" }} /><span>Correct</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: "#fee2e2", border: "1px solid #fca5a5" }} /><span>Incorrect</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: "#fffbeb", border: "1px solid #fcd34d" }} /><span>Flagged</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: "white", border: "1px solid var(--border-color)" }} /><span>Unanswered</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: "#dbeafe", border: "1px solid #3b82f6" }} /><span>Current</span></div>
            </div>
          </div>
        </div>
      )}

      {showPauseMenu && (
        <div className="exam-pause-overlay" onClick={() => handleResume()} style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="glass-card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, padding: 24, borderRadius: 20, textAlign: "center" }}>
            <Zap size={48} style={{ color: "#f59e0b", marginBottom: 12 }} />
            <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>Exam Paused</h2>
            <p style={{ margin: "0 0 20px", color: "var(--text-muted)" }}>Time is stopped. Take a break, then resume when ready.</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleExit}>Exit Exam</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleResume}><Zap size={16} /> Resume</button>
            </div>
          </div>
        </div>
      )}

      <main style={{ flex: 1, padding: 20, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {session.isComplete ? (
          <ResultsScreen session={session} handleExit={handleExit} />
        ) : (
          <QuestionScreen
            session={session}
            currentQuestion={currentQuestion}
            currentAnswer={currentAnswer}
            subjectColor={subjectColor}
            answeredCount={answeredCount}
            handleAnswer={handleAnswer}
            handleFlag={handleFlag}
            handleNext={handleNext}
            handlePrev={handlePrev}
            handleSubmit={handleSubmit}
          />
        )}
      </main>

      {showReview && session.isComplete && (
        <div className="exam-review-overlay" style={{ position: "fixed", inset: 0, background: "white", zIndex: 400, overflow: "auto", padding: 20 }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border-color)" }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Review Your Answers</h2>
              <button className="btn btn-ghost" onClick={() => setShowReview(false)}><XIcon size={20} /></button>
            </div>
            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>Review mode coming soon — for now, use "Retake Exam" to practice again.</p>
          </div>
        </div>
      )}
    </div>
  );
}