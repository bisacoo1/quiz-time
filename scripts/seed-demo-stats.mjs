#!/usr/bin/env node
/**
 * Seed a demo user with decks + study history and print a ready-to-paste
 * session cookie, so the Stats tab can be previewed without a real Google
 * login (the sandbox is offline — OAuth can't complete here).
 *
 * Uses the exact same mechanism as scripts/auth-e2e.mjs: a session JWT
 * minted with next-auth/jwt's encode() and the "authjs.session-token" salt.
 * AUTH_SECRET must match the server's.
 *
 * Usage:
 *   node scripts/seed-demo-stats.mjs [BASE_URL]
 *
 * Then in the preview browser console:
 *   document.cookie = "<printed cookie>; path=/"
 * and reload — you're signed in as "Demo Student".
 */
import pg from "pg";
import { encode } from "next-auth/jwt";

const BASE_URL = process.argv[2] ?? process.env.BASE_URL ?? "http://127.0.0.1:3000";
const AUTH_SECRET = process.env.AUTH_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
if (!AUTH_SECRET || !DATABASE_URL) {
  console.error("AUTH_SECRET and DATABASE_URL must be set (same values as the server).");
  process.exit(1);
}

const USER_ID = "demo-stats-user";
const pool = new pg.Pool({ connectionString: DATABASE_URL });

// Fresh demo data every run.
await pool.query("DELETE FROM users WHERE id = $1", [USER_ID]);
await pool.query(
  "INSERT INTO users (id, email, name, provider) VALUES ($1, 'demo@student.local', 'Demo Student', 'google')",
  [USER_ID]
);

async function deck(title, sourceType, cards) {
  const { rows } = await pool.query(
    "INSERT INTO study_sessions (title, source_type, summary, user_id) VALUES ($1, $2, $3, $4) RETURNING id",
    [title, sourceType, `Demo deck: ${title}`, USER_ID]
  );
  const sessionId = rows[0].id;
  const cardIds = [];
  for (let i = 0; i < cards; i++) {
    const c = await pool.query(
      "INSERT INTO flashcards (session_id, question, answer, difficulty, order_index) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [sessionId, `${title} — question ${i + 1}?`, `Answer ${i + 1}`, ["easy", "medium", "hard"][i % 3], i]
    );
    cardIds.push(c.rows[0].id);
  }
  return { sessionId, cardIds };
}

async function answer(sessionId, cardId, correct, mode, daysAgo, hour = 10) {
  const when = new Date(Date.now() - daysAgo * 86_400_000);
  when.setUTCHours(hour, (cardId * 7) % 60, 0, 0);
  await pool.query(
    "INSERT INTO study_results (user_id, session_id, card_id, correct, mode, answered_at) VALUES ($1, $2, $3, $4, $5, $6::timestamp)",
    [USER_ID, sessionId, cardId, correct, mode, when.toISOString().replace("T", " ").replace("Z", "")]
  );
}

const bio = await deck("Biology 101 — Cells", "pdf", 6);
const hist = await deck("World History — WWII", "image", 5);
const chem = await deck("Chemistry — Periodic Table", "docx", 4); // never studied

// 4-day streak: today, -1, -2, -3
await answer(bio.sessionId, bio.cardIds[0], true, "study", 0, 9);
await answer(bio.sessionId, bio.cardIds[1], false, "study", 0, 9);
await answer(bio.sessionId, bio.cardIds[1], true, "exam", 0, 12);
await answer(bio.sessionId, bio.cardIds[2], true, "exam", 0, 12);
await answer(hist.sessionId, hist.cardIds[0], true, "study", 1);
await answer(hist.sessionId, hist.cardIds[1], true, "study", 1);
await answer(hist.sessionId, hist.cardIds[2], false, "exam", 2);
await answer(bio.sessionId, bio.cardIds[3], true, "study", 2);
await answer(bio.sessionId, bio.cardIds[4], true, "exam", 3);
await answer(hist.sessionId, hist.cardIds[3], false, "exam", 3);

const payload = {
  userId: USER_ID,
  sub: USER_ID,
  email: "demo@student.local",
  name: "Demo Student",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  jti: `demo-${Date.now()}`,
};

// Auth.js derives BOTH the cookie name and the encryption salt from the
// protocol the app server sees (plain http → "authjs.session-token";
// https, incl. X-Forwarded-Proto: https from a proxy → the "__Secure-"
// variant). We can't always know what the tunnel forwards, so mint both —
// the browser sends both cookies and the server uses the one it expects.
const [plainToken, secureToken] = await Promise.all([
  encode({ token: payload, secret: AUTH_SECRET, salt: "authjs.session-token" }),
  encode({ token: payload, secret: AUTH_SECRET, salt: "__Secure-authjs.session-token" }),
]);

await pool.end();

console.log(`Seeded demo user "${USER_ID}" (3 decks, 10 answers, 4-day streak).`);
console.log(`\nPreview: ${BASE_URL}\n`);
console.log("Paste BOTH lines into the browser console on the preview page, then reload:\n");
console.log(`  document.cookie = "authjs.session-token=${plainToken}; path=/; max-age=86400";`);
console.log(`  document.cookie = "__Secure-authjs.session-token=${secureToken}; path=/; secure; max-age=86400";`);
console.log("\n(One of the two will be ignored depending on how the proxy forwards the request.)");
