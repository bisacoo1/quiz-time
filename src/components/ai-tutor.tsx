"use client";

import { useState } from "react";
import { LoaderCircle, MessageCircle, Send, Sparkles } from "lucide-react";

interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

export function AiTutor({
  question,
  answer,
  studentAnswer,
}: {
  question: string;
  answer: string;
  studentAnswer?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendMessage = async (message: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          answer,
          studentAnswer,
          message,
          history: messages.slice(-8),
        }),
      });
      const body = (await response.json()) as { explanation?: unknown; error?: unknown };
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "The tutor couldn't respond. Please try again.");
      }
      const explanation = body.explanation;
      if (typeof explanation !== "string" || !explanation.trim()) {
        throw new Error("The tutor returned an empty explanation. Please try again.");
      }
      setMessages((previous) => [
        ...previous,
        { role: "user", content: message },
        { role: "assistant", content: explanation },
      ]);
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The tutor couldn't respond. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const openTutor = () => {
    setOpen(true);
    if (messages.length === 0 && !loading) {
      void sendMessage(
        "Explain the key idea behind this answer in simple terms, why it is correct, and give a brief example."
      );
    }
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {!open ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={openTutor}
          style={{ alignSelf: "center", gap: 7, color: "var(--accent-dark)" }}
        >
          <Sparkles size={16} aria-hidden />
          Explain this with AI
        </button>
      ) : (
        <div
          className="glass-card"
          style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
          aria-live="polite"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
            <Sparkles size={17} aria-hidden style={{ color: "var(--accent-dark)" }} />
            AI Tutor
          </div>

          {messages.map((message, index) => {
            const content =
              message.role === "assistant"
                ? message.content.replace(/^#{1,6}\s+/gm, "")
                : message.content;
            return (
              <p
                key={index}
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.55,
                  color: message.role === "user" ? "var(--text-muted)" : "var(--text)",
                }}
              >
                {message.role === "user" ? "You: " : "Tutor: "}
                {content}
              </p>
            );
          })}

          {loading && (
            <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)" }}>
              <LoaderCircle size={16} className="animate-spin" aria-hidden />
              Thinking through this card…
            </p>
          )}
          {error && (
            <p role="alert" style={{ margin: 0, color: "#be123c", fontSize: 13 }}>
              {error}
            </p>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              const message = input.trim();
              if (message && !loading) void sendMessage(message);
            }}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              className="type-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={500}
              placeholder="Ask a follow-up about this card…"
              aria-label="Ask the AI tutor a follow-up"
              disabled={loading}
            />
            <button
              type="submit"
              className="btn btn-primary"
              aria-label="Send follow-up"
              disabled={loading || !input.trim()}
            >
              {input.trim() ? <Send size={17} aria-hidden /> : <MessageCircle size={17} aria-hidden />}
            </button>
          </form>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setOpen(false)}
            style={{ alignSelf: "flex-end" }}
          >
            Close tutor
          </button>
        </div>
      )}
    </section>
  );
}
