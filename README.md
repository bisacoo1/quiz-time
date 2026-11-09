# QuizTime – Flashcard Quiz Maker

Upload PDFs, Word documents, photos (several at once) or pasted text and
QuizTime turns them into flashcards, then helps you study them with quizzes,
an AI tutor and spaced repetition. It works offline as an installable PWA.

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [Creating decks](#creating-decks)
- [Studying](#studying)
- [Side by Side](#side-by-side)
- [Organizing decks](#organizing-decks)
- [Spaced repetition](#spaced-repetition)
- [Study stats](#study-stats)
- [AI model failover](#ai-model-failover)
- [Offline study](#offline-study)
- [Notifications](#notifications)
- [Accounts and sign-in](#accounts-and-sign-in)
- [Owner tools](#owner-tools)
- [Maintenance mode](#maintenance-mode)
- [Database and migrations](#database-and-migrations)
- [Deploying to Vercel](#deploying-to-vercel)
- [Testing](#testing)
- [Scripts](#scripts)

## Features

**Study modes**

- **Study** – traditional flashcards: read the question, tap to flip, reveal the
  answer, with optional hints and self-checking.
- **Exam** – multiple choice with 4 options, instant Correct / Wrong feedback
  and scoring (points, accuracy, letter grade, streaks).
- **Identification** – type the answer from memory. Checking is
  spelling-friendly: case, punctuation and small typos are forgiven, and any
  `/`-separated alternative counts. Same scoring as Exam.
- **Enumeration** – list every item from memory in any order. Cards whose
  answer is a list (items separated by ` ; `, e.g. "Mango ; Banana ; Orange")
  become "name them all" questions with per-item feedback.
- **Spaced Review** – a daily queue of only the cards you are about to forget,
  graded Again / Hard / Good / Easy.
- **Side by Side** – save a PDF or DOCX, read it in the app, highlight a passage
  for an AI explanation, and return later to your saved reading position.

**Learning aids**

- **AI Tutor** – after revealing or answering a card, get a plain-language
  explanation, an example, or a follow-up grounded in that card.
- **Weak spots** – Study Stats lists cards answered incorrectly at least twice,
  recent misses first. A card leaves the list after two consecutive correct
  answers. Start a mixed-deck **Practice weak spots** quiz from the list;
  results are recorded against each card's original deck.

**Creating and organizing**

- **Generated card review** – study the AI-generated cards first, then edit the
  title, description, questions, answers, hints and difficulty before saving.
  Add or remove cards, and remove exact duplicate question-and-answer pairs;
  removed cards can be restored with Undo.
- **Deck editing** – rename decks, add / edit / delete / reorder cards, or build
  a manual deck from scratch (no AI, no upload).
- **Subject folders** – group decks into subjects (Biology, History…), search
  everything from one box, and move decks between folders.

**Everywhere**

- **Offline study** – save decks to the device and study with no signal at all;
  progress syncs when you're back online.
- **Daily reminders** – optional in-app and web push reminders when cards are due.
- **Owner view** – set `OWNER_EMAIL` and that account gets a live "who's online"
  roster.

## Quick start

**Requirements**

- Node.js 20+
- PostgreSQL
- A Google Gemini API key ([aistudio.google.com](https://aistudio.google.com))
  and/or an OpenRouter key
- A Google OAuth client and an Auth.js secret (see
  [Accounts and sign-in](#accounts-and-sign-in))

**Setup**

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run db:migrate           # create the tables (idempotent)
npm run dev
```

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. **Required at build time** – `src/db/index.ts` throws if it's missing. |
| `GEMINI_API_KEY` | for generating cards¹ | Key for the primary provider (Google Gemini). |
| `OPENROUTER_API_KEY` | for generating cards¹ | Optional but recommended: used when every Gemini model is at its limit. See [AI model failover](#ai-model-failover). |
| `GEMINI_MODEL` | no | Overrides the main model. Default: `gemini-3.6-flash`. |
| `GEMINI_FALLBACK_MODELS` | no | Overrides the Gemini fallback order (comma-separated). Default: `gemini-3.1-flash-lite, antigravity, gemini-3.5-flash-lite`. `antigravity` is a Gemini agent with higher token use – drop it to save tokens. |
| `OPENROUTER_MODELS` | no | Overrides the OpenRouter fallback list (comma-separated). Default: `openrouter/free, nvidia/nemotron-3-super-120b-a12b:free, inclusionai/ling-3.0-flash-vl:free`. The free lineup rotates monthly – see [openrouter.ai/models](https://openrouter.ai/models) (filter "Free"). |
| `GEMINI_RATE_LIMIT_COOLDOWN_SECONDS` | no | How long a rate-limited model is skipped (default `300`). Google's own `retryDelay` hint wins when sent; the value is clamped to 15 s–30 min and doubles on repeated hits. |
| `AUTH_SECRET` | for sign-in | Auth.js secret. Generate with `openssl rand -base64 32`. |
| `AUTH_GOOGLE_ID` | for sign-in | Google OAuth client ID. |
| `AUTH_GOOGLE_SECRET` | for sign-in | Google OAuth client secret. |
| `BLOB_READ_WRITE_TOKEN` | for Side by Side | Read/write token for a **private** Vercel Blob store. Keep it server-only. |
| `OWNER_EMAIL` | no | The account that becomes the **owner** and sees the [who's online roster](#owner-tools). Case-insensitive; comma-separated addresses allowed. Empty or unset = feature off. |
| `MAINTENANCE_MODE` | no | `1`/`true`/`yes`/`on` enables [maintenance mode](#maintenance-mode). |
| `VAPID_PUBLIC_KEY` | for push | Web push public key. Generate with `npx web-push generate-vapid-keys`. |
| `VAPID_PRIVATE_KEY` | for push | Web push private key (same command). |
| `VAPID_SUBJECT` | for push | Contact for push services, e.g. `mailto:you@example.com`. |
| `CRON_SECRET` | for push | Bearer token for `/api/cron/reminders`. Generate with `openssl rand -hex 32`. |

¹ Cards can be generated with **either** AI key. With both, the app has a
longer safety net. Without the `VAPID_*` variables, the notification inbox
still works and the panel explains that push isn't configured.

> ⚠️ Never commit `.env`. It is listed in `.gitignore`; if it was ever pushed,
> rotate the keys.

## Creating decks

### Uploading

Pick up to **8 files at a time** (photos, screenshots, PDFs and/or Word `.docx`
files) – drag and drop, Gallery/Files or Camera all work. Everything you select
is sent to the AI together and combined into **one deck**.

- Photos are downscaled in the browser before upload (max ~1600px JPEG).
- PDFs and images go to Gemini directly. **Word files are converted to text on
  the server** (`mammoth`) because Gemini can't read `.docx` binaries. Old
  binary `.doc` files aren't supported – re-save as `.docx` or export to PDF.
- Limits: 15 MB per file, 24 MB total, 8 files.
- Generation is sign-in-only and rate-limited to 10 requests per 10 minutes per
  user on `/api/scan` (a soft limit, per server instance), so nobody can burn
  your AI free tier.
- Generated-but-unsaved decks are kept in `localStorage`; the Upload tab shows
  a banner to resume or discard them.

**Upload sizes on Vercel.** Vercel caps request bodies at 4.5 MB (`413
FUNCTION_PAYLOAD_TOO_LARGE`). Once the direct-upload budget (~4 MB) is used,
`src/app/page.tsx` parses PDFs to plain text **in the browser** with pdf.js
(`src/lib/pdf-text.ts`) and sends only the text to `/api/scan`, so multi-MB
lecture PDFs still work. Image-only (scanned) PDFs have no text layer, so
oversized scans are rejected with a clear message; small scans still go to
Gemini as files.

### Editing decks and manual decks

Every deck is editable after the fact, and decks can also be created by hand:

- **Manual decks** – "Create a Deck Manually" (Home) or **+ New** (My Study
  Sets) opens the editor with a blank deck. Add a title and cards one by one,
  then save – no upload or AI. Manual decks show a layers icon
  (`source_type = 'manual'`).
- **Rename** – the Title / Description fields rename any deck
  (`PATCH /api/sessions/[id]` with `{ title, summary }`).
- **Card CRUD and reorder** – edit each card's question, answer, hint and
  difficulty; arrows reorder; the trash icon deletes; **Add Card** appends.
  Saving sends the whole list to `PUT /api/sessions/[id]/cards`, which diffs it
  in one transaction. Edited cards **keep their database id**, so study
  progress, review schedules and stats survive an edit. Omitted cards are
  deleted (their progress cascades away), new ones are inserted, and array
  order becomes `order_index`.

Test coverage: `npm run test:deck-editor` (`scripts/deck-editor.test.mjs`, same
requirements as `npm run test:e2e`).

## Studying

### AI Tutor

In Study, Exam, Identification and Enumeration modes, reveal or submit an answer
and choose **Explain this with AI**. The tutor explains the concept and answers
follow-ups while keeping the card's question, answer and (when available) your
submitted answer in context. **Check my understanding** gives a short practice
question and feedback on your response.

The tutor uses the same Gemini/OpenRouter failover as card generation. It
requires sign-in and a network connection, and is rate-limited per account.

### Scoring in Exam mode

| Event | Points |
| --- | --- |
| Correct answer | 10 |
| Medium card | +5 |
| Hard card | +10 |
| Streak bonus | +2 per consecutive correct answer (capped at +10) |

The results screen shows accuracy, letter grade, points out of the maximum,
best streak, elapsed time, and a review of missed questions (which can be sent
straight into Study mode).

## Side by Side

Open **Read with AI · Side by Side** from the home screen to upload a PDF or
DOCX up to 50 MB per file, with 500 MB of total storage per account. Documents
are stored in a private Vercel Blob store and tied to the signed-in account.
Select text in the reader and choose **Explain with AI** to ask the tutor about
it. Follow-up questions stay grounded in the selected passage. PDF page
position and DOCX scroll position are saved so reading can resume later.
Documents can be deleted from the library.

Before enabling uploads, create and connect a **private** Vercel Blob store for
the project, then add its `BLOB_READ_WRITE_TOKEN` to local development and the
Vercel project environment. Never make this token public. PDF pages keep their
layout; DOCX files are displayed as readable text in this first version.

## Organizing decks

My Study Sets has an optional layer above the flat deck list: **subject
folders**. The screen has three parts:

- **Search** – filters both subjects (by name) and decks (by title) as you type.
- **Subjects** – folder rows with icon, name and live deck count. Tap one to
  open it: the same deck rows, filtered to that folder, plus **+ New Set** and
  **Add set manually**, which create decks already filed in the folder. The
  pencil renames the folder; the trash deletes the **folder only** – its decks
  drop back to All Sets and are never deleted.
- **All Sets** – decks not filed into a subject. Each row's folder button opens
  the **Move to Subject** sheet: pick a folder or create one on the spot. Use
  **Unfile** inside a subject to bring a deck back out.

Rules enforced by the API (`/api/subjects`, `subjectId` on `/api/sessions`):

- A deck lives in **at most one** subject (`study_sessions.subject_id`,
  nullable FK, `ON DELETE SET NULL`).
- Subject names are unique per account, **case-insensitively** – "Biology" vs
  "biology" returns a friendly 409.
- Every write is scoped to the signed-in user; a foreign folder is
  indistinguishable from a missing one (404).

Moving, creating and renaming need a connection. `subjectId` is part of the
offline snapshot, so grouping still renders offline – it just can't be changed
without a network.

## Spaced repetition

Study mode answers "do I know this?"; **Spaced Review** answers "what should I
study *today*?". Every graded card gets a schedule, and the **Review** tab shows
only the cards whose schedule has come up.

### Grades

After a card flips, you say how it felt:

| Grade | Meaning | Effect |
| --- | --- | --- |
| **Again** | Blanked / wrong | Back in **10 minutes**. A graduated card becomes a *lapse*: interval resets and ease drops by `0.20`. |
| **Hard** | Remembered, with effort | Interval × `1.2` (at least a day); ease − `0.15`. |
| **Good** | Remembered | Interval × ease factor – the normal path. |
| **Easy** | Instant | Interval × ease × `1.3`; ease + `0.15`. |

Buttons show what each grade will do ("Good · 3 days") before you tap, because
the client and the server run the **same** scheduler.

### The schedule

`src/lib/srs.ts` is a pure, dependency-free SM-2 descendant (the four-button
variant Anki uses):

- **New cards** start in a minutes-long *learning* phase: a first **Good** parks
  them 10 minutes out, the next graduates them to **1 day**. **Easy** skips
  straight to **4 days**.
- **Graduated cards** multiply their interval by their ease factor on Good
  (`1 → 3 → 8 → 20 → 50 → 125` days at the default ease of 2.5).
- **Lapses** reset the interval, relearn from 10 minutes, and lower ease (floor
  `1.3`) so trouble spots return often.
- Intervals are clamped to `[1 day, 365 days]`, ease to `[1.3, 2.8]`, and `now`
  is always injected rather than read from the clock, so the scheduler is
  deterministic and unit-tested.

Cards you found hard inside a session come back **in the same session** (up to
twice per card, so one card can't trap you in a loop).

### Where it lives in the app

- **Review tab** – today's queue across all decks, split into "due now" and
  brand-new cards, with a per-deck filter and a badge on the nav item.
- **My Study Sets** – each deck shows `N due` and a one-tap button into its queue.
- **A deck → Spaced Review** – unsaved decks can't use it (their cards have no
  server-side ids yet).
- **Home and Stats** – a banner when something is due; Stats adds "Due now" and
  "In rotation" tiles plus per-deck due counts. Review answers appear in the
  activity feed as *Spaced review*.
- **New cards per day are capped** (`NEW_CARDS_PER_DAY = 20`) so a fresh 80-card
  deck doesn't bury you: reviews you owe come first, then new cards in deck order.
- **Offline-friendly** – grades are queued locally and retried; leaving
  mid-session flushes pending grades with `navigator.sendBeacon`.

### API

| Route | Purpose |
| --- | --- |
| `GET /api/review?sessionId=&limit=` | `{ now, counts, nextDueAt, decks, queue }`. `counts` = `due`, `learning`, `tracked`, `newCards`, `newRemainingToday`, `newIntroducedToday`, `newPerDay`. `queue` holds cards to review now (overdue first, then new), capped by `limit` 1–100. A `sessionId` that isn't yours returns an empty queue, never someone else's cards. |
| `POST /api/review` | `{ reviews: [{ cardId, sessionId, grade, reviewedAt? }] }` (max 100). The server recomputes the schedule with the same pure functions, upserts `card_reviews`, writes a `study_results` row with mode `review`, and touches `card_progress`. Deck **and** card ownership are verified per entry; anything foreign is reported in `skipped[]`. Responses carry each card's new interval, `dueAt`, `dueLabel` and full state. |

`grade` must be `again`, `hard`, `good` or `easy` (anything else is skipped,
never silently coerced). A `reviewedAt` more than a day from the server clock is
ignored in favour of "now".

### `card_reviews` table

One row per `(user_id, card_id)` holding the schedule: `ease`, `interval_days`,
`reps`, `lapses`, `learning_step`, `review_count`, `last_grade`,
`last_reviewed_at`, `due_at`. `study_results` records *what happened*;
`card_reviews` records *when the card comes back*. It is keyed by user so a deck
can never leak progress, and deleting a deck or account cascades to its
schedules.

## Study stats

Every card answered in any study mode (Study, Exam, Identification, Enumeration
and Spaced Review) is recorded as a row in `study_results`: which deck, which
card, right/wrong, which mode, and when. Results live in the database, so
progress follows the user across devices. (`localStorage` is only a small draft
cache: answers recorded while a sync fails are retried on the next flush.)

The **Stats tab** (signed-in only) shows:

- **Overall** – cards studied, sessions, correct/incorrect, accuracy, and a 🔥
  **daily streak** (consecutive days with at least one answer; studying
  yesterday but not yet today keeps it alive).
- **Per deck** – cards studied, correct/incorrect, mastery % (studied cards ÷
  deck size), accuracy %, last studied date. Decks never studied render as
  friendly zeros.
- **Recent activity** – the last answers with deck, question and mode.
- **Spaced repetition rollup** – due now, learning, mature, lapses, reviewed
  today, next due.
- **Weak spots** – see [Features](#features).

### API

| Route | Purpose |
| --- | --- |
| `POST /api/stats/results` | Record outcomes: `{ results: [{ sessionId, cardId, correct, mode?, answeredAt? }] }` (max 100/batch). Deck **and** card ownership are verified per entry; entries pointing at another user's data are skipped and reported in `invalid`, never written. |
| `GET /api/stats` | `{ overall, decks, recent }` for the signed-in user only. Counts are cast `::int` (pg returns `bigint` strings for `count(*)`). `overall` also carries the review rollup (`reviewsTracked`, `dueNow`, `learning`, `mature`, `lapses`, `reviewedToday`, `nextDueAt`) and each deck gets `trackedCount`, `dueCount`, `matureCount`, `newCount`, `nextDueAt`. |

## AI model failover

Generation never fails just because one model is busy. The failover engine
(`src/lib/failover.ts`) walks a candidate list – one model on one provider per
step – and moves to the next candidate when one:

- **hits its rate limit or quota** (HTTP 429: "You exceeded your current
  quota", "Resource has been exhausted", "model is overloaded", or OpenRouter's
  "temporarily rate-limited upstream"), or
- **isn't available for your API key** (HTTP 404 / "not a valid model", a
  rejected key, a negative OpenRouter balance), or
- **physically can't read the upload** (e.g. a PDF sent to OpenRouter, which has
  no PDF input).

Anything else (a 400 bad request, a safety block, a network failure) is
rethrown immediately, because another model wouldn't fix it.

Default chain, best first:

`GEMINI_MODEL` (default `gemini-3.6-flash`) → `gemini-3.1-flash-lite` →
`antigravity` → `gemini-3.5-flash-lite` → `openrouter/free` →
`nvidia/nemotron-3-super-120b-a12b:free` → `inclusionai/ling-3.0-flash-vl:free`

A provider whose API key isn't configured is simply absent from the chain, so
the app works with Gemini only, OpenRouter only, or both.

### Behaviour

- **The switch is remembered.** A model that just ran out of quota is skipped
  for a cooldown window instead of being retried on every upload. Google's
  `retryDelay` hint is used when present, otherwise
  `GEMINI_RATE_LIMIT_COOLDOWN_SECONDS` (default 5 minutes). The window doubles
  each time the same model fails again in a row and is capped at 30 minutes;
  when it expires, the primary model is tried first again.
- **The user is told.** `POST /api/scan` returns the `model` and `provider` that
  produced the cards, plus a human-readable `notice` when it had to switch
  ("gemini-3.6-flash hit its request limit – generated with
  gemini-3.1-flash-lite instead."), which the UI shows as a toast.
- **When every model is at its limit**, the endpoint answers **429** ("Every AI
  model is at its request limit right now … please try again") rather than a
  generic 500.
- Cooldown notes live in module memory – one map per server instance, the same
  trade-off as the request rate limiter in `src/lib/rate-limit.ts`.

### OpenRouter fallback

[OpenRouter](https://openrouter.ai) is an OpenAI-compatible gateway with a
rotating pool of `:free` models, used as a last-resort safety net when every
Gemini model is out of quota.

- **Rate-limited, not metered:** about 20 requests/minute and **50 requests/day**
  on `:free` models, or **1,000/day** after a one-time $10 credit purchase (the
  credits never expire). A limit hit is a 429 and is handled exactly like a
  Gemini limit.
- **The roster rotates monthly.** Retired models 404 and get skipped, so the list
  is env-configurable (`OPENROUTER_MODELS`) and needs no code change.
  `openrouter/free` is a router that picks any available free model, which is
  why it leads the list.
- **Free models are low-priority:** upstream providers may refuse saturated
  requests with 429s, so the chain tries several OpenRouter models in a row.
  OpenRouter sometimes reports upstream failures as HTTP 200 with an `error`
  object in the body; the adapter lifts the real status out so it is classified
  correctly.
- **Input differences vs Gemini:** no PDF input, so PDFs are converted to text on
  the server (pdf.js; scanned PDFs without a text layer are rejected with a
  clear message). HEIC/HEIF photos aren't accepted – you get a "convert to
  JPEG/PNG" hint. Other images go across as base64 data URLs.
- **Privacy:** some free endpoints may use prompts for training. Keep that in
  mind for sensitive material.

## Offline study

QuizTime is a PWA and keeps working without a network. You can open the app,
get into your account, browse saved decks and study them; answers, grades and
progress are queued on the device and replayed automatically once you're back.

### What works offline

| Works offline | Needs a connection |
| --- | --- |
| Opening the app and the signed-in account (cached profile) | Signing in / out for the first time |
| **My Study Sets** (list, counts, "due" badges) | Creating a deck (upload + AI) |
| Study, Exam, Identification, Enumeration | Renaming, editing, deleting a deck |
| Spaced Review with real SM-2 scheduling | Downloading a deck you never opened |
| Progress, scores, streaks | Stats aggregates (the last synced copy is shown) |

New *material* still needs the network – the AI lives on the server and deck ids
are assigned by Postgres. Studying what you already have does not.

### How it fits together

1. **App shell (service worker, `public/sw.js`).** Navigations and build assets
   are cached, so an installed QuizTime opens with no network. The one API
   response the worker caches is `GET /api/auth/session`; without it, "signed in
   offline" is impossible. Only responses that contain a user are stored, and
   sign-out purges them.
2. **Snapshots (IndexedDB `quiztime-offline`).** Decks, cards, progress and
   `card_reviews` schedules are frozen client-side by `src/lib/offline.ts`. A
   deck is cached when you open it online; **Save for offline** on a deck row
   (or **Download all** on Home / My Sets) pins it deliberately. Everything is
   per-account and wiped on sign-out.
3. **Outbox (same database, `outbox` store).** The three writes that are safe to
   apply late – `POST /api/review`, `POST /api/stats/results` and
   `PATCH /api/sessions/[id]` card progress – are queued when undeliverable,
   then replayed in order, batched to the API's 100-entry limit. The worker also
   drains the queue in the background (Background Sync, Chrome/Edge/Android); on
   iOS the app drains on launch, on `online` and on focus.

Reads never depend on the worker: `loadDeckForStudy`, `loadOfflineSessionList`
and `loadReviewData` try the API first and fall back to the snapshot. The offline
review queue (`buildOfflineReviewData` in `src/lib/offline-core.ts`) mirrors the
server's: overdue cards first, then a daily helping of new cards, graded locally
with the same pure `scheduleCard()` the API uses.

### Where it lives

| File | Role |
| --- | --- |
| `src/lib/offline-core.ts` | Pure logic: snapshots, offline review queue, outbox batching/draining, backoff. Unit-tested. |
| `src/lib/offline.ts` | Browser glue: IndexedDB (+ in-memory fallback), connectivity, fallback loaders, outbox, purge. |
| `src/lib/use-offline.ts` | `useOnlineStatus`, `useOfflineIdentity` (offline sign-in), `useOutbox`. |
| `src/components/offline-ui.tsx` | Offline chip, notices, per-deck pin button, Home "Offline study" card. |
| `src/app/api/offline/bundle/route.ts` | `GET /api/offline/bundle[?sessionId=]` – everything a device needs in one request (≤200 decks / 5000 cards, reports `truncated`). |
| `public/sw.js` | App shell, cached session, background replay of the outbox. |

### Good to know

- **Replay is at-least-once.** A request that never reached the server is retried,
  so an answer graded the instant the connection dropped can count twice. The
  scheduler is forgiving (one extra grade ≈ one extra repetition), and queued
  grades always replay in the order you answered them.
- **Deletes win.** Deleting a deck removes its offline copy immediately.
- **Storage is best-effort.** `navigator.storage.persist()` is requested when you
  save decks, but a browser low on disk may still evict the cache. Signing out
  clears it deliberately.
- **Trying it:** `npm run dev`, open the app, then DevTools → Network → *Offline*
  (or airplane mode) and reload. You should see the offline chip, your saved
  decks and a "waiting to sync" counter. The worker is registered in development
  too (`/sw.js?dev=1`), where the dev server always wins so a cached chunk can
  never hide your changes.

## Notifications

A quiet, opt-in nudge when cards are due – **inside** the app (the bell's inbox)
and, if the student opts in, **outside** it (a web push notification, even with
QuizTime closed).

- One reminder per day, at the student's chosen local time, only when cards are
  actually due. Nothing is ever sent during a quiz.
- Strictly opt-in: the switch appears only after the browser grants permission
  and registers a push subscription. There is no permission prompt on first
  visit.
- The inbox keeps one row per reminded day, so "what was due yesterday" stays
  answerable in-app.
- iPhone/iPad: web push needs the PWA added to the Home Screen first (iOS 16.4+);
  the panel says so.

### How it works

1. The bell's panel (`src/components/notification-center.tsx`) asks for
   permission, subscribes via the service worker, and POSTs the subscription to
   `/api/notifications/subscribe`.
2. A scheduler calls `/api/cron/reminders` every 10 minutes. Each run finds users
   with due cards whose local clock is inside their reminder window
   (`reminderWindow` in `src/lib/notifications.ts`), writes **one** inbox row per
   (user, local day) – the unique key is the dedupe – and queues a delivery per
   device.
3. The same run drains the delivery queue with row leases and bounded retries (5
   min, 10 min, then give up). Endpoints the push service reports gone (404/410)
   are pruned.
4. `public/sw.js` shows the push and, on tap, focuses or opens a tab on
   `/?tab=review`.

Preferences live in `notification_preferences` (enabled, reminder time, IANA time
zone), devices in `push_subscriptions`, the once-per-day guard in
`notifications`, and send state in `push_deliveries`.

### API

| Route | Purpose |
| --- | --- |
| `GET /api/notifications` | Inbox, unread count, preferences, push status |
| `PATCH /api/notifications` | `{ enabled?, reminderTime?, timeZone?, markRead?: "all" \| number[] }` |
| `POST /api/notifications/subscribe` | Register this browser's push subscription |
| `DELETE /api/notifications/subscribe` | Forget this browser (last device off ⇒ enabled off) |
| `POST /api/notifications/test` | One test push to the account's devices |
| `GET/POST /api/cron/reminders` | Cron tick; `Authorization: Bearer $CRON_SECRET` |

Manual tick while developing:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
```

### Scheduler setup

Apply `drizzle/0008_push_notifications.sql` (see
[Database and migrations](#database-and-migrations)), set the four env vars
(`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`), and
make sure something calls the route every ~10 minutes:

- **Vercel Hobby (default here):** Hobby's own cron is daily-only, so
  `.github/workflows/reminders-cron.yml` is the scheduler. Set the repo
  **secret** `CRON_SECRET` (same value as the Vercel env var) and the repo
  **variable** `CRON_URL` (your deployment origin, e.g.
  `https://<your-deployment>.vercel.app`). Scheduled runs begin once the
  workflow is on the default branch; the Actions tab can trigger a manual tick.
- **Vercel Pro:** add a `crons` entry to `vercel.json`
  (`"schedule": "*/10 * * * *"`). The inbox dedupe makes overlapping schedulers
  harmless.
- **Other hosts:** any cron that calls the route with
  `Authorization: Bearer $CRON_SECRET` works.

## Accounts and sign-in

Visitors see a **login page first** (QuizTime logo + Continue with Google). After
sign-in they land in the app. Decks are private to each account: uploading,
generating, studying and deleting all require a session, and every query is
scoped to the signed-in user (there is no anonymous data, so nobody can read or
delete someone else's decks by guessing an id).

### 1. Create the Google OAuth client

1. Go to [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials).
2. **Create credentials → OAuth client ID → Web application**.
3. Authorized JavaScript origins: `https://<your-domain>`
   (locally: `http://localhost:3000`).
4. Authorized redirect URIs: `https://<your-domain>/api/auth/callback/google`
   (locally: `http://localhost:3000/api/auth/callback/google`).
5. Copy the client ID and secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

### 2. Set the Auth.js secret

```bash
openssl rand -base64 32   # → AUTH_SECRET
```

### How it works

- **Auth.js v5 with JWT sessions** – stateless and serverless-friendly. On first
  sign-in the profile is upserted into `users` and the user id is pinned into the
  session token.
- `study_sessions.user_id` links every deck to its owner (`ON DELETE CASCADE`,
  `ON UPDATE CASCADE`). The column is nullable so the migration is safe on
  databases created before accounts; older decks from before sign-in existed
  belong to no account.
- When a sign-in re-keys a `users` row (the same email arriving under a new Google
  `sub`, see `src/auth.ts`), the `ON UPDATE CASCADE` foreign keys make a user's
  decks and results follow the new id.
- The card-generating endpoint is sign-in-only, and its rate limit is bucketed
  per user.

## Owner tools

### Who's online

Set one env var and that account becomes the **owner**:

```bash
OWNER_EMAIL=you@example.com        # comma-separated list is allowed
```

The owner gets a live **Who's online** strip above the page content ("3 online
›"). Tapping it opens a roster of everybody who has an account:

- **Online now** – a heartbeat in the last 90 seconds (green dot, live count).
- **Recently active** – "12 min ago", "yesterday", with what they were last
  looking at ("Studying “Cell Biology”") and a coarse device label
  ("Safari · iPhone") – never a raw user-agent string.
- **Never seen** – accounts that have signed in but never checked in since this
  feature shipped.

**What is collected, and who sees it.** Each signed-in browser reports a short
activity label, a coarse device label and a last-seen time. Only the owner
account(s) can read any of it: the strip renders from `session.user.isOwner`, and
`/api/presence` re-checks the session's email against `OWNER_EMAIL` on every
request (401 anonymous, 403 other signed-in users, without disclosing who the
owner is).

**How it works**

- Every signed-in browser sends a heartbeat to `POST /api/presence` every 30 s
  (`HEARTBEAT_INTERVAL_MS`). A user is **online** while their last heartbeat is
  younger than 90 s (`ONLINE_WINDOW_SECONDS`) – three beats of slack, so one
  missed beat never flickers anybody offline.
- Closing a tab needs no "goodbye": the beats stop and the user drops out of the
  window. Background tabs pause; returning to the tab checks in immediately.
- One upserted row per user (`user_presence`): one small write per heartbeat, no
  sockets, no Redis.
- Ages are measured by the **database** (`now()` minus the row), never by a client
  timestamp, so clock skew and timezones can't stretch the window. The rules live
  in `src/lib/presence.ts` (pure, unit-tested in `scripts/presence.test.mjs`), the
  React glue in `src/lib/use-presence.ts`, and the UI in
  `src/components/owner-presence.tsx`.
- The client only ever sends a *label*: control characters are stripped, values
  are length-capped (60 chars for activity, 40 for device), and the user id
  always comes from the session, never the request body.

**API**

| Route | Purpose |
| --- | --- |
| `POST /api/presence` | Heartbeat from any signed-in user: `{ activity?, device? }` → `{ ok: true, online }`, where `online` is the live count for the owner and `null` for everybody else. |
| `GET /api/presence` | The roster – **owner only**: `{ online, total, windowSeconds, users: [{ id, name, email, image, isOwner, online, lastSeenSecondsAgo, activity, device }] }`. Every account is listed, online first, then most recent; `lastSeenSecondsAgo` is `null` for accounts that never checked in. |

**When the database isn't ready.** The roster doesn't dead-end on a missing
table or give one generic guess for every failure:

- **The app creates its own table.** `drizzle/0005_presence.sql` is idempotent, so
  when a query fails with *relation "user_presence" does not exist* the route
  runs those statements (`src/lib/presence-schema.ts`) and retries once. Only
  that one table is touched, and a failed attempt backs off for 60 s so a role
  without `CREATE` isn't hammered by every heartbeat.
- **Every failure says what it is.** Failures return `{ "error": "…", "reason":
  "…" }` with a 503 (500 if unclassified); `src/lib/db-errors.ts` classifies and
  `src/lib/use-presence.ts` maps the reason to advice:

  | `reason` | Meaning | The panel says |
  | --- | --- | --- |
  | `missing_table` | `user_presence` is gone and couldn't be created | Run the migration |
  | `permission` | The database refused the `CREATE` | Ask the database owner to run the SQL, or grant `CREATE` |
  | `unreachable` | The server can't reach the database | `DATABASE_URL` points at a host that is down |
  | `credentials` | The database rejected the password | The credentials in `DATABASE_URL` changed |
  | `auth` | Auth.js itself failed | A server setting (`AUTH_SECRET`), not the database |
  | `unknown` | Anything else | Something went wrong server-side; check the log |

  The raw Postgres error never leaves the server – only the short `reason`
  string does.
- A failed poll never blanks a roster that already loaded; the panel keeps it and
  notes that it may be out of date.

**Good to know**

- Presence is a *hint*: someone who closes the tab shows as online for up to 90 s,
  and a user with no connection simply ages out (the app skips heartbeats while
  offline).
- Changing `OWNER_EMAIL` takes effect on the next request (it's read per call,
  never baked into the JWT), so moving the owner needs no rebuild or re-login.
- Rows aren't deleted on sign-out or after a long absence – "last seen 3 weeks
  ago" is what the roster is for. Deleting a user cascades their row away.

To see the roster without real users, open `/clay-preview` – it renders the same
components with sample data, no sign-in needed.

## Maintenance mode

Set `MAINTENANCE_MODE=1` (also `true`/`yes`/`on`) and restart the server:

- **Signed-out visitors** get a server-rendered "We'll be right back" page
  instead of the app. Only the designated maintenance owner account can sign in;
  other Google accounts are rejected before a session is created.
- **Existing non-owner sessions** are also denied app access, including protected
  API requests. The maintenance owner sees the normal app with a fixed amber
  banner across the top. Set `OWNER_EMAIL` to the same address to enable
  owner-only features such as the online roster.
- `GET /api/health` reports the current state in a `maintenance` field.

The toggle is read from the environment **per request** and the page tree is
forced dynamic, so turning it on or off needs only a restart, not a rebuild. On
Vercel, change the env var and redeploy/restart the functions.

## Database and migrations

Migrations are committed under `drizzle/`. Apply them with:

```bash
npm run db:migrate
```

All migrations are **idempotent**, so they are safe to re-run and safe on
databases created earlier. To change the schema:

```bash
# edit src/db/schema.ts, then:
npm run db:generate   # writes a new SQL file into drizzle/
npm run db:migrate    # applies it
```

**Production (Supabase or any hosted Postgres).** If you can't run
`npm run db:migrate` against the production database, paste the contents of the
migration file into the SQL editor and run it once:

| File | Adds |
| --- | --- |
| `drizzle/0002_study_results.sql` | `study_results` table and indexes |
| `drizzle/0003_cute_susan_delgado.sql` | `ON UPDATE cascade` on the user foreign keys |
| `drizzle/0004_spaced_repetition.sql` | `card_reviews` table, unique index (makes the `POST /api/review` upsert atomic) and indexes |
| `drizzle/0005_presence.sql` | `user_presence` table (the app can also create this itself) |
| `drizzle/0008_push_notifications.sql` | Notification preference, subscription, inbox and delivery tables |

Deleting a deck or account cascades to its results and schedules.

**No Postgres installed?** `scripts/dev-pglite-server.mjs` runs an embedded
Postgres (PGlite) with a wire-protocol server:

```bash
node scripts/dev-pglite-server.mjs 5433 &
DATABASE_URL=postgresql://postgres@127.0.0.1:5433/quiztime npm run db:migrate
```

## Deploying to Vercel

1. Push the repo to GitHub and **Import Project** in Vercel (framework preset:
   Next.js – no config needed).
2. In **Project Settings → Environment Variables**, add the variables from
   [Environment variables](#environment-variables). At minimum: `DATABASE_URL`,
   an AI key (`GEMINI_API_KEY` and/or `OPENROUTER_API_KEY`), and `AUTH_SECRET`,
   `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. Add `OWNER_EMAIL`, the `VAPID_*` /
   `CRON_SECRET` set and `MAINTENANCE_MODE` as needed.
3. Create the tables: run `npm run db:migrate` once against that database
   (locally, with `DATABASE_URL` pointing at it).
4. Deploy. If the build fails with `DATABASE_URL is required`, the variable wasn't
   set before the build started.
5. For reminders, set up the scheduler (see
   [Scheduler setup](#scheduler-setup)).

### Installed apps and updates (service worker)

The app is installable (`public/manifest.json`; `"id": "/"` keeps the install
identity stable). `public/sw.js` keeps installed home-screen apps in sync with
every deploy – each deploy replaces content-hashed assets, so stale HTML would
404 its CSS/JS and open unstyled. It is also what makes
[offline study](#offline-study) possible. It is registered by
`src/components/register-sw.tsx` (in development as `/sw.js?dev=1`).

- **Navigations (HTML): network-first.** Every launch fetches fresh HTML; the
  cache is only an offline fallback (`caches.match("/")`).
- **Immutable assets (`/_next/static/*`, `/images/*`): cache-first**, filled on
  first fetch. In dev: network-first, cached only as the offline fallback.
- **`GET /api/auth/session`: network-first, cached when it contains a user**, so
  the signed-in account survives with no network. Purged on sign-out.
- **Every other `/api/*` response is never cached.** The IndexedDB snapshots are
  the single offline source of truth for deck data.
- **`/sw.js` is served with `Cache-Control: no-cache, no-store, must-revalidate`**
  plus `Service-Worker-Allowed: /` (see `next.config.ts`), so browsers detect new
  versions immediately.
- **`skipWaiting()` + `clients.claim()`** activate a new worker right away, and
  activation purges every cache that isn't current.
- To force-invalidate all cached content, **bump `VERSION` in `public/sw.js`**
  (e.g. `quiztime-v3`); the cache namespace changes and old caches are deleted on
  activation.
- **Failed non-GET requests to the three replayable routes** are queued in
  IndexedDB and answered with `202 {queued:true}`; a `sync` event replays them
  with no tab open. Everything else fails normally, because it can't be applied
  later.
- **`quiztime-outbox` is the Background Sync tag.** The worker posts
  `{type:"OUTBOX_SYNCED", synced, remaining}` to open windows so the UI can
  refresh and toast. Store names, the queued-write shape and batching rules
  mirror `src/lib/offline-core.ts`; `scripts/offline.test.mjs` fails if the two
  drift apart.

## Testing

The sandbox/dev environment can't complete a real Google OAuth flow, so
`scripts/auth-e2e.mjs` mints Auth.js session JWTs directly with
`next-auth/jwt`'s `encode()` (salt `authjs.session-token`) and exercises the API
over HTTP. It verifies, among other things, that **user A can neither read nor
write user B's decks, study results or review schedules** – grading someone
else's card is skipped and never written (`skipped[]`). It also walks the review
schedule end to end: learning steps, graduation, lapses, deck badges, the
`?sessionId` filter, and the cascade when a deck is deleted.

```bash
# 1. point DATABASE_URL/AUTH_SECRET at a test database (see .env.local)
node scripts/setup-test-db.mjs          # creates db + applies all migrations (idempotent)
npm run build && npm run start          # or: npm run dev
# 2. in another shell (reuses a running server, or spawns its own):
BASE_URL=http://127.0.0.1:3000 npm run test:e2e
BASE_URL=http://127.0.0.1:3000 npm run test:offline-e2e
BASE_URL=http://127.0.0.1:3000 OWNER_EMAIL=you@example.com npm run test:presence-e2e
```

- **`scripts/presence-e2e.mjs`** covers the owner roster: 401 for anonymous
  callers, 403 for signed-in non-owners (without leaking the owner's address), a
  non-owner heartbeat that records presence but never returns the count,
  sanitisation of client input, the online/offline boundary either side of the
  90 s window, upsert-not-insert, and the cascade on user delete. It signs in as
  the *first* address in `OWNER_EMAIL`, proving the env var, not the database,
  decides who the owner is. A server started for this suite must see the same
  `OWNER_EMAIL`.
- **`scripts/offline-e2e.test.mjs`** drives the real client module
  (`src/lib/offline.ts`) over HTTP with a minted session cookie, fakes only the
  browser (`window`, `navigator.onLine`, and a `fetch` that throws to simulate
  losing the network), then checks the *database* to prove answers landed. It
  covers: the bundle freezing decks, cards and schedules; the deck list and
  review queue resolving from the snapshot with the network down; grades,
  outcomes and progress queueing locally; the drain writing back to
  `card_reviews` / `study_results` / `card_progress`; a dead session keeping the
  queue instead of dropping it; and sign-out purging the device copy.
- **The service worker is run, not just read:** `public/sw.js` is evaluated in a
  fake `ServiceWorkerGlobalScope` with minimal Cache Storage and IndexedDB fakes,
  and its handlers are dispatched with real `Request`/`Response` objects. That
  pins down the cached session (sign in online → go offline → the account still
  opens), the 202 an offline grade gets instead of a failure, the shell fallback
  for deep links, and the background drain batching two grades into one request.

These suites need neither a database nor an API key:

```bash
npm run test:failover    # failover engine, driven with Gemini/OpenRouter-shaped 429/404/401 errors
npm run test:openrouter  # OpenRouter adapter (parts→content, error normalization), fake endpoint
npm run test:scan        # the whole POST /api/scan handler, real SDK + adapter against fake endpoints
npm run test:srs         # spaced-repetition scheduler: learning steps, graduation, lapses, ease clamping, previews
```

`scripts/seed-demo-stats.mjs` seeds a demo user with decks, study history and a
mixed review queue (overdue, learning and upcoming cards), and prints a session
cookie you can paste into the browser console to preview the Stats and Review
tabs where Google sign-in can't complete.

## Scripts

```bash
npm run dev               # dev server
npm run build             # production build
npm run start             # serve the production build
npm run lint              # eslint
npm run typecheck         # tsc --noEmit
npm run db:generate       # generate a new migration from src/db/schema.ts
npm run db:migrate        # apply committed migrations to DATABASE_URL
npm run db:setup-test     # create/reset the local test db + apply migrations
npm run test:failover     # failover-engine unit tests (no db, no network)
npm run test:openrouter   # OpenRouter adapter tests (fake endpoint)
npm run test:scan         # /api/scan failover tests (real SDK, fake endpoints)
npm run test:srs          # spaced-repetition scheduler tests (no db, no network)
npm run test:presence     # "who's online" rules: owner email, window, sanitisers
npm run test:db-errors    # database-failure taxonomy + self-heal DDL (no db needed)
npm run test:offline      # offline core + browser glue + service-worker contract
npm run test:offline-e2e  # offline round trip against a real server + database
npm run test:e2e          # auth/stats e2e suite (minted JWTs, real HTTP)
npm run test:presence-e2e # owner-only roster e2e (needs OWNER_EMAIL, db + server)
npm run test:deck-editor  # deck editor e2e (same requirements as test:e2e)
npm run test:mode-switch  # quiz mode tab row: sideways drag/scroll (Playwright, mocked APIs)
```

## Notes

- `GET /api/config` tells the frontend whether an AI key is set, so the app shows
  the setup screen instead of a broken upload form.
- `GET /api/health` also pings the database (503 when the DB is down) and reports
  whether maintenance mode is on.
