import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { users, studySessions, flashcards, cardReviews, cardProgress } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { getBoardExamForCourse, getBoardSubjectsForCourse, BoardExam, BoardSubject } from "@/lib/board-exams";

export const maxDuration = 30;

/**
 * GET /api/board-readiness
 *
 * Computes board exam readiness for the signed-in user.
 *
 * Logic:
 * 1. Get user's course → board exam → subjects with weights
 * 2. Find all user's flashcards (across all their study sets)
 * 3. Classify each card into a board subject (via AI or keyword matching)
 * 4. For each subject: compute mastery from spaced repetition (cardReviews)
 * 5. Weight by board exam subject weights → overall readiness %
 *
 * Returns:
 * {
 *   examCode: "BLEPT",
 *   examName: "Board Licensure Examination for Professional Teachers",
 *   course: "BS Secondary Education",
 *   overallReadiness: 67,           // 0-100 weighted %
 *   daysUntilExam: 142,             // if targetExamDate set
 *   subjects: [
 *     {
 *       subjectCode: "GENED",
 *       subjectName: "General Education",
 *       weight: 20,
 *       mastery: 72,                // 0-100
 *       cardsTotal: 62,
 *       cardsMastered: 45,
 *       weakTopics: ["Assessment", "Philippine Literature"]
 *     },
 *     ...
 *   ],
 *   recommendations: [
 *     "Focus on Professional Education — Assessment of Learning (34% mastery)",
 *     "You're strong in General Education Math (89%)"
 *   ]
 * }
 */

// Simple keyword-based subject classification (can be enhanced with AI later)
function classifyCardSubject(card: { question: string; answer: string }, subjects: BoardSubject[]): string {
  const text = `${card.question} ${card.answer}`.toLowerCase();

  // For BLEPT: check for subject-specific keywords
  const subjectKeywords: Record<string, string[]> = {
    GENED: [
      "english", "filipino", "math", "mathematics", "algebra", "geometry", "statistics",
      "science", "biology", "chemistry", "physics", "earth science",
      "history", "economics", "politics", "philosophy", "social studies",
      "literature", "communication", "grammar", "writing", "reading",
      "philippine history", "rizal", "constitution", "governance"
    ],
    PROFED: [
      "teaching", "learning", "assessment", "evaluation", "curriculum",
      "pedagogy", "instruction", "classroom", "management", "strategy",
      "method", "approach", "technique", "lesson plan", "objective",
      "bloom", "taxonomy", "formative", "summative", "rubric",
      "development", "child", "adolescent", "piaget", "vygotsky", "erikson",
      "technology", "ict", "multimedia", "digital", "online",
      "inclusive", "special education", "differentiated",
      "ethics", "profession", "code of ethics", "legal basis",
      "motivation", "reinforcement", "conditioning", "constructivism"
    ],
    MAJOR: [
      // Major-specific keywords are harder to auto-detect without knowing the major
      // For now, if not GENED or PROFED, assume MAJOR
    ],
  };

  let bestSubject = "MAJOR"; // default
  let bestScore = 0;

  for (const subject of subjects) {
    const keywords = subjectKeywords[subject.code] || [];
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestSubject = subject.code;
    }
  }

  return bestSubject;
}

// Compute mastery from cardReviews (SM-2 ease factor + interval)
function computeMasteryFromReviews(reviews: Array<{ ease: number; intervalDays: number; reps: number; lapses: number; lastGrade: string | null }>): number {
  if (reviews.length === 0) return 0;

  // Weighted mastery: higher ease + longer intervals + more reps = higher mastery
  // Each review contributes: ease factor (1.3-2.8) normalized, interval log-scaled, rep bonus
  let totalWeight = 0;
  let weightedSum = 0;

  for (const r of reviews) {
    // Ease factor contribution (1.3 = struggling, 2.8 = easy)
    const easeScore = ((r.ease - 1.3) / (2.8 - 1.3)) * 40; // 0-40 points

    // Interval contribution (log scale: 1 day=10, 10 days=20, 100 days=30, 1000 days=40)
    const intervalScore = Math.min(40, Math.log10(Math.max(1, r.intervalDays)) * 13.3);

    // Reps contribution (diminishing returns)
    const repsScore = Math.min(20, r.reps * 2);

    // Lapses penalty
    const lapsePenalty = Math.min(30, r.lapses * 5);

    // Last grade bonus/penalty
    let gradeScore = 0;
    if (r.lastGrade === "easy") gradeScore = 10;
    else if (r.lastGrade === "good") gradeScore = 5;
    else if (r.lastGrade === "hard") gradeScore = -5;
    else if (r.lastGrade === "again") gradeScore = -15;

    const reviewScore = Math.max(0, Math.min(100, easeScore + intervalScore + repsScore - lapsePenalty + gradeScore));

    // Weight recent reviews more heavily
    totalWeight += 1;
    weightedSum += reviewScore;
  }

  return Math.round(weightedSum / totalWeight);
}

export async function GET() {
  try {
    const guard = await requireUser();
    if (guard instanceof NextResponse) return guard;

    const userId = guard.user.id;

    // 1. Get user's course and board exam
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user?.course) {
      return NextResponse.json({
        error: "No course set",
        message: "Set your course in the profile to see board exam readiness",
      }, { status: 400 });
    }

    const course = user.course;
    const exam = getBoardExamForCourse(course);

    if (!exam) {
      return NextResponse.json({
        error: "No board exam for this course",
        message: `${course} does not have a mapped board exam yet`,
        course,
      }, { status: 400 });
    }

    // 2. Get all user's flashcards with their spaced repetition data
    const userDecks = await db
      .select({ id: studySessions.id })
      .from(studySessions)
      .where(eq(studySessions.userId, userId));

    const deckIds = userDecks.map(d => d.id);
    if (deckIds.length === 0) {
      return NextResponse.json({
        examCode: exam.code,
        examName: exam.name,
        course,
        overallReadiness: 0,
        daysUntilExam: user.targetExamDate
          ? Math.ceil((new Date(user.targetExamDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
        subjects: exam.subjects.map(s => ({
          subjectCode: s.code,
          subjectName: s.name,
          weight: s.weight,
          mastery: 0,
          cardsTotal: 0,
          cardsMastered: 0,
          weakTopics: [],
        })),
        recommendations: ["Create your first study set to start tracking readiness!"],
      });
    }

    // Get all flashcards with their review data
    const cardsWithReviews = await db
      .select({
        cardId: flashcards.id,
        question: flashcards.question,
        answer: flashcards.answer,
        sessionId: flashcards.sessionId,
        ease: cardReviews.ease,
        intervalDays: cardReviews.intervalDays,
        reps: cardReviews.reps,
        lapses: cardReviews.lapses,
        lastGrade: cardReviews.lastGrade,
      })
      .from(flashcards)
      .leftJoin(cardReviews, and(
        eq(cardReviews.cardId, flashcards.id),
        eq(cardReviews.userId, userId)
      ))
      .where(inArray(flashcards.sessionId, deckIds));

    // 3. Classify cards into board subjects
    const subjects = exam.subjects;
    const subjectData: Record<string, {
      cards: typeof cardsWithReviews;
      reviews: typeof cardsWithReviews;
    }> = {};

    for (const s of subjects) {
      subjectData[s.code] = { cards: [], reviews: [] };
    }

    for (const card of cardsWithReviews) {
      const subjectCode = classifyCardSubject({ question: card.question, answer: card.answer }, subjects);
      if (subjectData[subjectCode]) {
        subjectData[subjectCode].cards.push(card);
        if (card.ease !== null) {
          subjectData[subjectCode].reviews.push(card);
        }
      }
    }

    // 4. Compute mastery per subject
    const subjectResults = subjects.map(s => {
      const data = subjectData[s.code];
      const cardsTotal = data.cards.length;
      const reviews = data.reviews;

      const mastery = computeMasteryFromReviews(reviews.map(r => ({
        ease: r.ease ?? 2.5,
        intervalDays: r.intervalDays ?? 0,
        reps: r.reps ?? 0,
        lapses: r.lapses ?? 0,
        lastGrade: r.lastGrade,
      })));

      // Cards "mastered" = interval >= 21 days (monthly review) or ease > 2.5
      const cardsMastered = reviews.filter(r =>
        (r.intervalDays ?? 0) >= 21 || (r.ease ?? 2.5) > 2.5
      ).length;

      // Identify weak topics (simplified: subjects with < 60% mastery)
      const weakTopics: string[] = [];
      if (mastery < 60 && cardsTotal > 0) {
        weakTopics.push(`${s.name} (${mastery}% mastery)`);
      }

      return {
        subjectCode: s.code,
        subjectName: s.name,
        weight: s.weight,
        mastery,
        cardsTotal,
        cardsMastered,
        weakTopics,
      };
    });

    // 5. Overall weighted readiness
    let weightedSum = 0;
    let totalWeight = 0;
    for (const sr of subjectResults) {
      weightedSum += sr.mastery * sr.weight;
      totalWeight += sr.weight;
    }
    const overallReadiness = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    // 6. Days until exam
    let daysUntilExam: number | null = null;
    if (user.targetExamDate) {
      const target = new Date(user.targetExamDate);
      const now = new Date();
      daysUntilExam = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    // 7. Generate recommendations
    const recommendations: string[] = [];

    // Weak subjects
    const weakSubjects = subjectResults
      .filter(s => s.mastery < 60 && s.cardsTotal > 0)
      .sort((a, b) => a.mastery - b.mastery);

    for (const ws of weakSubjects.slice(0, 3)) {
      recommendations.push(
        `Focus on ${ws.subjectName} — ${ws.mastery}% mastery (${ws.weight}% of exam)`
      );
    }

    // Strong subjects
    const strongSubjects = subjectResults
      .filter(s => s.mastery >= 80 && s.cardsTotal > 0)
      .sort((a, b) => b.mastery - a.mastery);

    for (const ss of strongSubjects.slice(0, 2)) {
      recommendations.push(
        `You're strong in ${ss.subjectName} (${ss.mastery}% mastery) — maintain with weekly review`
      );
    }

    // Empty subjects
    const emptySubjects = subjectResults.filter(s => s.cardsTotal === 0);
    if (emptySubjects.length > 0) {
      recommendations.push(
        `No cards yet for: ${emptySubjects.map(s => s.subjectName).join(", ")} — create study sets for these topics`
      );
    }

    // Exam countdown advice
    if (daysUntilExam !== null) {
      if (daysUntilExam <= 30) {
        recommendations.unshift(`⚠️ ${daysUntilExam} days until your exam — do daily simulated exams!`);
      } else if (daysUntilExam <= 90) {
        recommendations.unshift(`📅 ${daysUntilExam} days until exam — aim for 2+ hours daily review`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push("Keep studying! Create more flashcards to see detailed readiness.");
    }

    return NextResponse.json({
      examCode: exam.code,
      examName: exam.name,
      course,
      overallReadiness,
      daysUntilExam,
      targetExamDate: user.targetExamDate,
      subjects: subjectResults,
      recommendations,
    });
  } catch (error) {
    console.error("Board readiness error:", error);
    const message = error instanceof Error ? error.message : "Failed to compute readiness";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}