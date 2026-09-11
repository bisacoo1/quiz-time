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
- Google OAuth client + Auth.js secret (for sign-in — see [Accounts](#accounts--sign-in-with-google))

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run db:migrate           # create the database tables (idempotent)
npm run dev
```

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. **Required at build time** – `src/db/index.ts` throws if it's missing. |
| `GEMINI_API_KEY` | for generating cards | Without it the app shows a setup screen instead of the upload form. |
| `GEMINI_MODEL` | no | Overrides the main model. Default main model is `gemini-3.6-flash`, which falls back to `gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-1.5-flash` if it isn't available for your key. |
| `AUTH_SECRET` | for sign-in | Auth.js secret. Generate: `openssl rand -base64 32`. |
| `AUTH_GOOGLE_ID` | for sign-in | Google OAuth client ID. |
| `AUTH_GOOGLE_SECRET` | for sign-in | Google OAuth client secret. |

> ⚠️ Never commit `.env`. It is listed in `.gitignore`; if it was ever pushed,
> rotate the API key.

## Database setup

Migrations are committed under `drizzle/`. Apply them with:

```bash
npm run db:migrate
```

The initial migration is **idempotent** — safe to re-run, and safe on
databases that were already created with the old hand-pasted SQL (it adds the
`summary` column, the `card_progress` unique constraint, and the indexes).

To make schema changes later:

```bash
# edit src/db/schema.ts, then:
npm run db:generate   # writes a new SQL file into drizzle/
npm run db:migrate    # applies it
```

## Accounts & Sign-in with Google

Decks are private to each account: the app requires sign-in for
uploading, generating, studying and deleting study sets, and every query is
scoped to the signed-in user (there is no anonymous data, so nobody can read
or delete somebody else's decks by guessing an id).

### 1. Create the Google OAuth client

1. Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
2. **Create credentials → OAuth client ID → Web application**
3. Authorized JavaScript origins: `https://<your-domain>`
   (locally: `http://localhost:3000`)
4. Authorized redirect URIs: `https://<your-domain>/api/auth/callback/google`
   (locally: `http://localhost:3000/api/auth/callback/google`)
5. Copy the client ID and secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`

### 2. Set the Auth.js secret

```bash
openssl rand -base64 32   # → AUTH_SECRET
```

### How it works

- **Auth.js v5 (JWT sessions)** — stateless, serverless-friendly. On first
  sign-in the profile is upserted into the `users` table and the user id is
  pinned into the session token.
- `study_sessions.user_id` links every deck to its owner (`ON DELETE
  CASCADE`). The column is nullable so the migration is safe on databases
  created before accounts; decks created before sign-in existed are orphaned
  (they belong to no account).
- The Gemini-generating endpoint is also sign-in-only, and the rate limit is
  now bucketed per user.

## Deploying to Vercel

1. Push the repo to GitHub and **Import Project** in Vercel (framework preset:
   Next.js — no config needed).
2. In **Project Settings → Environment Variables**, add:
   - `DATABASE_URL` (e.g. Vercel Postgres / Neon connection string)
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL` (optional)
   - `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (see Accounts)
3. Create the tables: run `npm run db:migrate` once against that database
   (locally, with `DATABASE_URL` pointing at it).
4. Deploy. If the build fails with `DATABASE_URL is required`, the variable
   wasn't set before the build started.

## Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm run start       # serve the production build
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run db:generate # generate a new migration from src/db/schema.ts
npm run db:migrate  # apply committed migrations to DATABASE_URL
```

## Notes

- **AI generation is sign-in-only** and rate-limited to 10 requests per 10
  minutes per user on `/api/scan` (soft limit, per server instance) so nobody
  can burn your Gemini free tier.
- `GET /api/config` tells the frontend whether `GEMINI_API_KEY` is set, so the
  app shows the setup screen instead of a broken upload form.
- `GET /api/health` also pings the database (returns 503 when the DB is down).
- Generated-but-unsaved decks are kept in `localStorage`; the Upload tab shows
  a banner to resume or discard them.

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
