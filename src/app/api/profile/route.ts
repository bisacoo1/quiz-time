import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { getBoardExamCodeForCourse } from "@/lib/board-exams";

// A course is a short label ("BS Pharmacy"), not a paragraph.
const MAX_COURSE_LEN = 80;

/**
 * GET /api/profile → { course: string | null, boardExamCode: string | null, targetExamDate: string | null }
 *
 * The signed-in user's course, set in the first-login course picker.
 * `null` means "not chosen yet" (or they skipped it).
 */
export async function GET() {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, guard.user.id))
    .limit(1);
  return NextResponse.json({
    course: row?.course ?? null,
    boardExamCode: row?.boardExamCode ?? null,
    targetExamDate: row?.targetExamDate ?? null,
  });
}

/**
 * PATCH /api/profile  { course: string } | { course: null, boardExamCode?: string, targetExamDate?: string }
 *
 * Sets (or clears) the user's course. Trims and length-caps the value;
 * an empty string is treated as clearing, so the UI can't strand a
 * user behind a blank course.
 *
 * When a course is set, automatically derives and sets the boardExamCode
 * based on the course-program mapping in src/lib/board-exams.ts.
 */
export async function PATCH(request: NextRequest) {
  const guard = await requireUser();
  if (guard instanceof NextResponse) return guard;

  let body: { course?: unknown; boardExamCode?: unknown; targetExamDate?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Handle course update
  const rawCourse = body.course;
  if (rawCourse !== null && rawCourse !== undefined && rawCourse !== "" && typeof rawCourse !== "string") {
    return NextResponse.json({ error: "course must be a string or null" }, { status: 400 });
  }

  const course =
    rawCourse === null || rawCourse === undefined || rawCourse === "" ? null : (rawCourse as string).trim().slice(0, MAX_COURSE_LEN);

  // Auto-derive board exam code from course
  const boardExamCode = course ? getBoardExamCodeForCourse(course) : null;

  // Handle target exam date (optional, ISO date string "YYYY-MM-DD")
  let targetExamDate: string | null = null;
  if (body.targetExamDate !== undefined && body.targetExamDate !== null && body.targetExamDate !== "") {
    if (typeof body.targetExamDate !== "string") {
      return NextResponse.json({ error: "targetExamDate must be a string (YYYY-MM-DD) or null" }, { status: 400 });
    }
    // Basic validation: YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.targetExamDate)) {
      return NextResponse.json({ error: "targetExamDate must be in YYYY-MM-DD format" }, { status: 400 });
    }
    targetExamDate = body.targetExamDate;
  } else if (body.targetExamDate === null) {
    targetExamDate = null;
  }

  const [row] = await db
    .update(users)
    .set({ course, boardExamCode, targetExamDate })
    .where(eq(users.id, guard.user.id))
    .returning();

  return NextResponse.json({
    course: row?.course ?? course,
    boardExamCode: row?.boardExamCode ?? boardExamCode,
    targetExamDate: row?.targetExamDate ?? targetExamDate,
  });
}
