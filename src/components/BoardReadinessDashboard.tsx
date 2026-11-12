"use client";

import { useEffect, useState } from "react";
import { Target, Flag, RefreshCw, AlertTriangle, BookOpen, CalendarClock } from "lucide-react";
import { getBoardExamCodeForCourse } from "@/lib/board-exams";

interface SubjectReadiness {
  subjectCode: string;
  subjectName: string;
  weight: number;
  mastery: number;
  cardsTotal: number;
  cardsMastered: number;
  weakTopics: string[];
}

interface BoardReadinessData {
  examCode: string;
  examName: string;
  course: string;
  overallReadiness: number;
  daysUntilExam: number | null;
  targetExamDate: string | null;
  subjects: SubjectReadiness[];
  recommendations: string[];
}

export function BoardReadinessDashboard() {
  const [data, setData] = useState<BoardReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noExam, setNoExam] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState(false);
  const [targetDateInput, setTargetDateInput] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setNoExam(null);
        const res = await fetch("/api/board-readiness", { cache: "no-store" });
        const result = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 400) {
            setNoExam(typeof result.message === "string" ? result.message : "Set a board-exam course to see readiness.");
            return;
          }
          throw new Error(result.error || `HTTP ${res.status}`);
        }
        setData(result);
        setTargetDateInput(typeof result.targetExamDate === "string" ? result.targetExamDate : "");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load readiness");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchReadiness = async () => {
    try {
      setLoading(true);
      setError(null);
      setNoExam(null);
      const res = await fetch("/api/board-readiness", { cache: "no-store" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 400) {
          setNoExam(typeof result.message === "string" ? result.message : "Set a board-exam course to see readiness.");
          return;
        }
        throw new Error(result.error || `HTTP ${res.status}`);
      }
      setData(result);
      setTargetDateInput(typeof result.targetExamDate === "string" ? result.targetExamDate : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load readiness");
    } finally {
      setLoading(false);
    }
  };

  const saveTargetDate = async () => {
    if (!targetDateInput) return;
    setSavingDate(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetExamDate: targetDateInput }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save date");
      }
      await fetchReadiness();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save target date");
    } finally {
      setSavingDate(false);
    }
  };

  const handleSimulateExam = () => {
    if (!data) return;
    window.location.href = `/board-exam?exam=${encodeURIComponent(data.examCode)}`;
  };

  const handleGenerateDrills = () => {
    if (!data) return;
    const weakest = data.subjects
      .filter((s) => s.cardsTotal === 0 || s.mastery < 70)
      .sort((a, b) => a.mastery - b.mastery || b.weight - a.weight)
      .slice(0, 2)
      .map((s) => s.subjectCode);
    const subjectParam = weakest[0] ? `&subject=${encodeURIComponent(weakest[0])}` : "";
    window.location.href = `/board-exam?exam=${encodeURIComponent(data.examCode)}&mode=drill${subjectParam}`;
  };

  const getReadinessColor = (value: number) => {
    if (value >= 80) return { bg: "#dcfce7", text: "#166534", border: "#86efac" };
    if (value >= 60) return { bg: "#fef9c3", text: "#854d0e", border: "#fde047" };
    if (value >= 40) return { bg: "#ffedd5", text: "#9a3412", border: "#fb923c" };
    return { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" };
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div className="spinner" style={{ width: 40, height: 40, margin: "0 auto 16px", borderWidth: 3 }} />
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>Computing your board exam readiness...</p>
      </div>
    );
  }

  if (noExam) {
    return (
      <div className="glass-card" style={{ padding: 24, borderRadius: 16, textAlign: "center" }}>
        <Target size={40} style={{ color: "var(--accent-dark)", marginBottom: 12 }} />
        <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>Board exam mode</h3>
        <p style={{ margin: "0 0 16px", color: "var(--text-muted)" }}>{noExam}</p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
          Choose a board-exam course (e.g. BS Education, BS Nursing, BS Accountancy) in your profile to unlock readiness tracking and mock exams.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: "center", background: "#fee2e2", borderRadius: 16, border: "1px solid #fecaca" }}>
        <AlertTriangle size={32} style={{ color: "#dc2626", marginBottom: 12 }} />
        <h3 style={{ margin: "0 0 8px", color: "#991b1b" }}>Could not load readiness</h3>
        <p style={{ margin: "0 0 16px", color: "#b91c1c", fontSize: 14 }}>{error}</p>
        <button className="btn btn-primary" onClick={() => void fetchReadiness()}>
          <RefreshCw size={16} /> Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const overallColor = getReadinessColor(data.overallReadiness);

  return (
    <section style={{ padding: "8px 0", display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="glass-card" style={{ padding: 20, borderRadius: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>{data.examCode}</p>
            <h2 style={{ margin: "4px 0", fontSize: 20, fontWeight: 800 }}>{data.examName}</h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>{data.course}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: overallColor.text }}>{data.overallReadiness}%</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>Weighted readiness</div>
          </div>
        </div>
        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <CalendarClock size={16} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {data.daysUntilExam === null ? "No target exam date set" : data.daysUntilExam < 0 ? "Target date passed" : `${data.daysUntilExam} day${data.daysUntilExam === 1 ? "" : "s"} until exam`}
            </span>
          </div>
          <input
            type="date"
            value={targetDateInput}
            onChange={(e) => setTargetDateInput(e.target.value)}
            aria-label="Target exam date"
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", font: "inherit" }}
          />
          <button className="btn btn-secondary btn-sm" onClick={() => void saveTargetDate()} disabled={savingDate || !targetDateInput}>
            {savingDate ? "Saving..." : "Save target date"}
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ padding: 20, borderRadius: 16 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
          <Target size={18} /> Subject breakdown (board exam weights)
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.subjects.map((subject) => {
            const color = getReadinessColor(subject.mastery);
            return (
              <div key={subject.subjectCode} style={{ border: `1px solid ${color.border}`, borderRadius: 12, padding: 12, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{subject.subjectName} ({subject.subjectCode})</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{subject.weight}% of exam · {subject.cardsMastered}/{subject.cardsTotal} cards mastered</div>
                  </div>
                  <div style={{ fontWeight: 800, color: color.text }}>{subject.mastery}%</div>
                </div>
                <div style={{ height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${subject.mastery}%`, height: "100%", background: color.text }} />
                </div>
                {subject.weakTopics.length > 0 && (
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "#991b1b" }}>Priority: {subject.weakTopics.join(", ")}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {data.recommendations.length > 0 && (
        <div className="glass-card" style={{ padding: 20, borderRadius: 16 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800 }}>Study next</h3>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
            {data.recommendations.map((rec, i) => (
              <li key={`${i}-${rec.slice(0, 20)}`} style={{ fontSize: 13.5, lineHeight: 1.5 }}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button className="btn btn-primary btn-lg" style={{ width: "100%" }} onClick={handleSimulateExam}>
          <Flag size={18} /> Start full mock exam
        </button>
        <button className="btn btn-secondary btn-lg" style={{ width: "100%" }} onClick={handleGenerateDrills}>
          <BookOpen size={18} /> Practice weak-area drill
        </button>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
          Drills start a focused exam session on your lowest-mastery subject. Full mock exams follow the official blueprint and save results to your readiness.
        </p>
      </div>
    </section>
  );
}
