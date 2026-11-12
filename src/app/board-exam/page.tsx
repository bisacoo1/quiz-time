"use client";

import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { BoardExamSimulator } from "@/components/BoardExamSimulator";
import { getBoardExamByCode } from "@/lib/board-exams";

function BoardExamPageContent() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const examCode = searchParams.get("exam") || "BLEPT";
  const subjectCode = searchParams.get("subject");
  const mode = searchParams.get("mode") === "drill" ? "drill" : "full";
  const exam = getBoardExamByCode(examCode);
  const examName = exam?.name || "Board Exam";

  if (status === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    );
  }

  if (status === "unauthenticated") {
    const cb = `/board-exam?exam=${examCode}${subjectCode ? `&subject=${subjectCode}` : ""}${mode === "drill" ? "&mode=drill" : ""}`;
    router.push(`/login?callbackUrl=${encodeURIComponent(cb)}`);
    return null;
  }

  if (!exam) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p>Unknown exam code.</p>
      </div>
    );
  }

  return (
    <BoardExamSimulator
      examCode={examCode}
      examName={examName}
      subjectCode={subjectCode}
      mode={mode}
      onExit={() => {
        window.location.href = "/board-readiness";
      }}
    />
  );
}

export default function BoardExamPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}><div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} /></div>}>
      <BoardExamPageContent />
    </Suspense>
  );
}
