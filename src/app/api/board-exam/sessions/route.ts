import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { boardExamSessions } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { getBoardExamByCode } from "@/lib/board-exams";

export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const examCode = typeof b.examCode === "string" ? b.examCode : null;
  const config = b.config && typeof b.config === "object" ? (b.config as Record<string, unknown>) : null;
  const score = typeof b.score === "number" ? b.score : null;
  const passed = typeof b.passed === "boolean" ? b.passed : null;
  const timeUsedMinutes = typeof b.timeUsedMinutes === "number" ? b.timeUsedMinutes : null;
  const subjectResults = Array.isArray(b.subjectResults) ? b.subjectResults : null;
  const answers = Array.isArray(b.answers) ? b.answers : null;
  const flaggedQuestions = Array.isArray(b.flaggedQuestions) ? b.flaggedQuestions : [];
  const startedAt = typeof b.startedAt === "string" ? b.startedAt : null;

  if (!examCode || !config || score === null || passed === null || timeUsedMinutes === null || !subjectResults || !answers || !startedAt) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const exam = getBoardExamByCode(examCode);
  if (!exam) {
    return NextResponse.json({ error: "Unknown exam code" }, { status: 400 });
  }

  const safeConfig = {
    totalQuestions: typeof config.totalQuestions === "number" ? config.totalQuestions : answers.length,
    totalMinutes: typeof config.totalMinutes === "number" ? config.totalMinutes : exam.totalMinutes,
    subjectBreakdown: Array.isArray(config.subjectBreakdown) ? config.subjectBreakdown : [],
  };

  const [row] = await db
    .insert(boardExamSessions)
    .values({
      userId: guard.user.id,
      examCode,
      config: safeConfig as never,
      score,
      passed,
      timeUsedMinutes: Math.max(0, Math.round(timeUsedMinutes)),
      subjectResults: subjectResults as never,
      answers: answers as never,
      flaggedQuestions: flaggedQuestions.filter((n): n is number => typeof n === "number"),
      startedAt: new Date(startedAt),
      completedAt: new Date(),
    })
    .returning({ id: boardExamSessions.id });

  return NextResponse.json({ ok: true, id: row?.id ?? null });
}
