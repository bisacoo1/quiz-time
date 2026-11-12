"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  Target,
  AlertTriangle,
  TrendingUp,
  BookOpen,
  Clock,
  Zap,
  ArrowRight,
  RefreshCw,
  Trophy,
  Flag,
} from "lucide-react";
import { BoardSubject } from "@/lib/board-exams";

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
  const [simulatingExam, setSimulatingExam] = useState(false);
  const [generatingDrills, setGeneratingDrills] = useState(false);

  const fetchReadiness = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/board-readiness", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load readiness");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadiness();
  }, []);

  const handleSimulateExam = async () => {
    setSimulatingExam(true);
    try {
      // Navigate to board exam simulator page
      window.location.href = "/board-exam";
    } catch (err) {
      console.error("Failed to start simulated exam:", err);
    } finally {
      setSimulatingExam(false);
    }
  };

  const handleGenerateDrills = async () => {
    setGeneratingDrills(true);
    try {
      // TODO: Call API to generate weak-area drill sets
      // For now, navigate to upload with pre-filled weak topics
      if (data) {
        const weakSubjects = data.subjects
          .filter(s => s.mastery < 60 && s.cardsTotal > 0)
          .map(s => s.subjectName)
          .join(", ");
        const url = `/upload?focus=${encodeURIComponent(weakSubjects)}`;
        window.location.href = url;
      }
    } catch (err) {
      console.error("Failed to generate drills:", err);
    } finally {
      setGeneratingDrills(false);
    }
  };

  const formatDays = (days: number | null) => {
    if (days === null) return "Not set";
    if (days < 0) return `Exam passed (${Math.abs(days)} days ago)`;
    if (days === 0) return "Today!";
    if (days === 1) return "Tomorrow";
    if (days <= 7) return `${days} days`;
    if (days <= 30) return `${Math.ceil(days / 7)} week${Math.ceil(days / 7) > 1 ? "s" : ""}`;
    return `${Math.ceil(days / 30)} month${Math.ceil(days / 30) > 1 ? "s" : ""}`;
  };

  const getReadinessColor = (value: number) => {
    if (value >= 80) return { bg: "#dcfce7", text: "#166534", border: "#86efac" }; // green
    if (value >= 60) return { bg: "#fef9c3", text: "#854d0e", border: "#fde047" }; // yellow
    if (value >= 40) return { bg: "#ffedd5", text: "#9a3412", border: "#fb923c" }; // orange
    return { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" }; // red
  };

  const getOverallColor = (value: number) => {
    if (value >= 80) return "linear-gradient(135deg, #10b981, #059669)";
    if (value >= 60) return "linear-gradient(135deg, #f59e0b, #d97706)";
    if (value >= 40) return "linear-gradient(135deg, #f97316, #ea580c)";
    return "linear-gradient(135deg, #ef4444, #dc2626)";
  };

  if (loading) {
    return (
      <div className="board-readiness-loading" style={{ padding: 40, textAlign: "center" }}>
        <div className="spinner" style={{ width: 40, height: 40, margin: "0 auto 16px", borderWidth: 3 }} />
        <p style={{ color: "var(--text-muted)", fontSize: 15 }}>Computing your board exam readiness...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="board-readiness-error" style={{ padding: 24, textAlign: "center", background: "#fee2e2", borderRadius: 16, border: "1px solid #fecaca" }}>
        <AlertTriangle size={32} style={{ color: "#dc2626", marginBottom: 12 }} />
        <h3 style={{ margin: "0 0 8px", color: "#991b1b" }}>Couldn't load readiness</h3>
        <p style={{ margin: "0 0 16px", color: "#b91c1c", fontSize: 14 }}>{error}</p>
        <button className="btn btn-primary" onClick={fetchReadiness}>
          <RefreshCw size={16} /> Try Again
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { examCode, examName, course, overallReadiness, daysUntilExam, subjects, recommendations } = data;
  const overallColor = getOverallColor(overallReadiness);

  return (
    <section className="board-readiness-dashboard" style={{ padding: "8px 0" }}>
      {/* Header Card */}
      <div
        className="glass-card"
        style={{
          padding: 24,
          borderRadius: 20,
          background: overallColor,
          color: "white",
          marginBottom: 20,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, opacity: 0.9, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {examCode} Readiness
              </p>
              <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>{examName}</h2>
              <p style={{ margin: 0, fontSize: 14, opacity: 0.95 }}>{course}</p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  border: "4px solid rgba(255,255,255,0.4)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "inset 0 2px 8px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.15)",
                }}
              >
                <span style={{ fontSize: 28, fontWeight: 900 }}>{overallReadiness}%</span>
                <span style={{ fontSize: 11, opacity: 0.9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Ready</span>
              </div>
            </div>
          </div>

          {/* Countdown */}
          {daysUntilExam !== null && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", padding: "8px 14px", borderRadius: 12 }}>
                <Clock size={16} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  {daysUntilExam <= 30 ? "⚠️ " : ""}{formatDays(daysUntilExam)} until exam
                </span>
              </div>
              {data.targetExamDate && (
                <span style={{ fontSize: 12, opacity: 0.8 }}>Target: {new Date(data.targetExamDate).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}</span>
              )}
            </div>
          )}
        </div>

        {/* Decorative brain icon */}
        <Brain
          size={120}
          style={{
            position: "absolute",
            right: -20,
            bottom: -30,
            opacity: 0.1,
            strokeWidth: 0.5,
          }}
          aria-hidden
        />
      </div>

      {/* Subject Breakdown */}
      <div className="glass-card" style={{ padding: 20, borderRadius: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Target size={20} style={{ color: "var(--accent-dark)" }} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Subject Breakdown</h3>
          <span className="badge" style={{ background: "#f3e8ff", color: "#6d28d9" }}>
            Weighted by board exam % ({subjects.reduce((a, b) => a + b.weight, 0)}% total)
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {subjects.map((subject) => {
            const color = getReadinessColor(subject.mastery);
            const isWeak = subject.mastery < 60 && subject.cardsTotal > 0;
            const isEmpty = subject.cardsTotal === 0;

            return (
              <div
                key={subject.subjectCode}
                style={{
                  background: isWeak ? "#fff1f2" : isEmpty ? "#f8fafc" : "transparent",
                  border: `1px solid ${isWeak ? "#fecaca" : isEmpty ? "#e2e8f0" : color.border}`,
                  borderRadius: 14,
                  padding: 16,
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: color.bg,
                        color: color.text,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {subject.subjectCode}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h4 style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {subject.subjectName}
                      </h4>
                      <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-muted)" }}>
                        {subject.weight}% of exam · {subject.cardsTotal} card{subject.cardsTotal !== 1 ? "s" : ""} · {subject.cardsMastered} mastered
                      </p>
                    </div>
                  </div>
                  <div
                    style={{
                      width: 60,
                      textAlign: "right",
                      fontSize: 16,
                      fontWeight: 800,
                      color: color.text,
                      flexShrink: 0,
                    }}
                  >
                    {subject.mastery}%
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${subject.mastery}%`,
                      height: "100%",
                      background: isEmpty ? "linear-gradient(90deg, #94a3b8, #cbd5e1)" : `linear-gradient(90deg, ${color.text}, ${color.border})`,
                      borderRadius: 4,
                      transition: "width 0.8s ease-out",
                    }}
                  />
                </div>

                {/* Status badges */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {isWeak && (
                    <span className="badge" style={{ background: "#fee2e2", color: "#991b1b", display: "flex", alignItems: "center", gap: 4 }}>
                      <AlertTriangle size={10} /> Priority Review
                    </span>
                  )}
                  {subject.mastery >= 80 && subject.cardsTotal > 0 && (
                    <span className="badge" style={{ background: "#dcfce7", color: "#166534", display: "flex", alignItems: "center", gap: 4 }}>
                      <TrendingUp size={10} /> Strong
                    </span>
                  )}
                  {isEmpty && (
                    <span className="badge" style={{ background: "#f1f5f9", color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                      <BookOpen size={10} /> No cards yet
                    </span>
                  )}
                  {subject.weakTopics.length > 0 && subject.weakTopics.map((topic, i) => (
                    <span key={i} className="badge" style={{ background: "#fef3c7", color: "#92400e", fontSize: 10.5 }}>
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="glass-card" style={{ padding: 20, borderRadius: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Zap size={20} style={{ color: "#f59e0b" }} />
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Smart Recommendations</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recommendations.map((rec, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 14px",
                  background: i === 0 && daysUntilExam !== null && daysUntilExam <= 30 ? "#fef2f2" : "#f8fafc",
                  borderRadius: 10,
                  border: i === 0 && daysUntilExam !== null && daysUntilExam <= 30 ? "1px solid #fecaca" : "1px solid #e2e8f0",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: i === 0 ? "#ef4444" : "var(--accent-dark)",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--text)" }}>{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          className="btn btn-primary btn-lg"
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          onClick={handleSimulateExam}
          disabled={simulatingExam}
        >
          {simulatingExam ? (
            <>
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)", borderTopColor: "white" }} />
              Starting...
            </>
          ) : (
            <>
              <Flag size={20} />
              <span>Simulate Board Exam</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>

        <button
          className="btn btn-secondary btn-lg"
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
          onClick={handleGenerateDrills}
          disabled={generatingDrills || !subjects.some(s => s.mastery < 60 && s.cardsTotal > 0)}
        >
          {generatingDrills ? (
            <>
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)", borderTopColor: "white" }} />
              Generating...
            </>
          ) : (
            <>
              <BookOpen size={20} />
              <span>Generate Weak-Area Drills</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          Simulated exams use curated past-board questions + AI-generated items matched to your weak areas.
          Drills create focused study sets for your lowest-mastery subjects.
        </p>
      </div>

      {/* Tips footer */}
      <div className="glass-card" style={{ padding: 16, borderRadius: 14, marginTop: 20, background: "#f0f9ff", border: "1px solid #bae6fd" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Trophy size={20} style={{ color: "#0369a1", flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700, color: "#0369a1" }}>How readiness is calculated</p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#0369a1", lineHeight: 1.7 }}>
              <li>Each flashcard is classified into a board subject (by keywords)</li>
              <li>Mastery comes from your spaced repetition data (ease factor, interval, reps, lapses)</li>
              <li>Subject scores are weighted by the <strong>official board exam percentages</strong></li>
              <li>Overall = weighted average — just like the real exam!</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}