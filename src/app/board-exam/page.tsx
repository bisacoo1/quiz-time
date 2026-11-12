"use client";

import { useSession } from "next-auth/react";
import { BoardExamSimulator } from "@/components/BoardExamSimulator";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

export default function BoardExamPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const examCode = searchParams.get("exam") || "BLEPT";

  // Get exam name from code
  const examNames: Record<string, string> = {
    BLEPT: "Board Licensure Examination for Professional Teachers",
    NLE: "Nurse Licensure Examination",
    CELE: "Civil Engineering Licensure Examination",
    MLE: "Medical Technology Licensure Examination",
    RADTECH: "Radiologic Technology Licensure Examination",
    CRIM: "Criminology Licensure Examination",
    CPA: "Certified Public Accountant Licensure Examination",
  };

  const examName = examNames[examCode] || "Board Exam";
  const courseNames: Record<string, string> = {
    BLEPT: "BS Education",
    NLE: "BS Nursing",
    CELE: "BS Civil Engineering",
    MLE: "BS Medical Technology",
    RADTECH: "BS Radiologic Technology",
    CRIM: "BS Criminology",
    CPA: "BS Accountancy",
  };
  const course = courseNames[examCode] || "Your Course";

  if (status === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    );
  }

  const router = useRouter();

  if (status === "unauthenticated") {
    router.push(`/login?callbackUrl=/board-exam?exam=${examCode}`);
    return null;
  }

  const handleComplete = (result: {
    score: number;
    passed: boolean;
    subjectResults: { subjectCode: string; correct: number; total: number; score: number }[];
    answers: any[];
    timeUsedMinutes: number;
  }) => {
    // Result is handled by the component (shows results screen)
    // Could also save to database here via API call
    console.log("Exam completed:", result);
  };

  const handleExit = () => {
    window.location.href = "/board-readiness";
  };

  return (
    <BoardExamSimulator
      examCode={examCode}
      examName={examName}
      course={course}
      onComplete={handleComplete}
      onExit={handleExit}
    />
  );
}