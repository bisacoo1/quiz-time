# QuizTime – Flashcard Quiz Maker

Upload PDFs, Word documents, photos (several at once), or pasted text and
QuizTime turns them into flashcards, then lets you review them two ways:

- **Study Mode** – traditional flashcards: read the question, tap to flip the
  card and reveal the answer, with optional hints and self-checking.
- **Exam Mode** – multiple choice: 4 options per question, instant
  Correct / Wrong feedback, and a scoring system (points, accuracy, letter
  grade, streaks).

## Uploading

Pick up to **8 files at a time** (photos, screenshots, PDFs and/or Word
`.docx` files) from the upload screen — drag & drop, Gallery/Files or Camera all
work. Every file you select is sent to the AI together and combined into **one
study set** covering all of them.

- Photos are downscaled in the browser before upload (max ~1600px JPEG).
- PDFs and images are sent to Gemini directly; **Word files are converted to
  text on the server** (`mammoth`) because Gemini can't read `.docx` binaries.
  Old binary `.doc` files aren't supported — re-save them as `.docx` or export
  to PDF.
- Limits: 15 MB per file, 24 MB total, 8 files.

## Requirements

- Node.js 20+
- PostgreSQL database
- Google Gemini API key ([aistudio.google.com](https://aistudio.google.com))

## Local setup

```bash
npm install
cp .env .env.local   # then fill in the values (see below)
npm run dev
```

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. **Required at build time** – `src/db/index.ts` throws if it's missing. |
| `GEMINI_API_KEY` | for generating cards | Without it the app shows a setup screen instead of the upload form. |
| `GEMINI_MODEL` | no | Overrides the main model. Default main model is `gemini-3.6-flash`, which falls back to `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-1.5-flash` if it isn't available for your key. |

> ⚠️ Never commit `.env`. It is listed in `.gitignore`; if it was ever pushed,
> rotate the API key.

## Database setup

There are no committed migrations yet, so create the tables once against your
database (SQL console or `psql`):

```sql
CREATE TABLE "study_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "source_type" text NOT NULL,
  "source_text" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "flashcards" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_id" integer NOT NULL,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "hint" text,
  "difficulty" text DEFAULT 'medium' NOT NULL,
  "order_index" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "card_progress" (
  "id" serial PRIMARY KEY NOT NULL,
  "card_id" integer NOT NULL,
  "session_id" integer NOT NULL,
  "is_known" boolean DEFAULT false NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_reviewed_at" timestamp DEFAULT now()
);

ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_session_id_study_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade;
ALTER TABLE "card_progress" ADD CONSTRAINT "card_progress_card_id_flashcards_id_fk"
  FOREIGN KEY ("card_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade;
ALTER TABLE "card_progress" ADD CONSTRAINT "card_progress_session_id_study_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade;
```

(Equivalent to `npx drizzle-kit generate` + applying the generated SQL.)

## Deploying to Vercel

1. Push the repo to GitHub and **Import Project** in Vercel (framework preset:
   Next.js — no config needed).
2. In **Project Settings → Environment Variables**, add:
   - `DATABASE_URL` (e.g. Vercel Postgres / Neon connection string)
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (optional)
3. Create the tables from the SQL above in that database.
4. Deploy. If the build fails with `DATABASE_URL is required`, the variable
   wasn't set before the build started.

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## Scoring in Exam Mode

| Event | Points |
| --- | --- |
| Correct answer | 10 |
| Medium card | +5 |
| Hard card | +10 |
| Streak bonus | +2 per consecutive correct answer (capped at +10) |

The results screen shows accuracy %, letter grade, points out of the maximum,
best streak, elapsed time, and a review of the questions you missed (which can
be sent straight into Study Mode).
