"use client";

import { useSession } from "next-auth/react";
import { BoardReadinessDashboard } from "@/components/BoardReadinessDashboard";
import { useRouter } from "next/navigation";

export default function BoardReadinessPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/login?callbackUrl=/board-readiness");
    return null;
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 800 }}>Board Exam Readiness</h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 15 }}>
          Track your weighted mastery across official board exam subjects
        </p>
      </header>
      <BoardReadinessDashboard />
    </main>
  );
}