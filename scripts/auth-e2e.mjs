#!/usr/bin/env node
/**
 * E2E: per-user scoping of the stats/results API (P2 — Study Stats).
 *
 * The dev sandbox is offline, so a real Google login can't complete here.
 * Instead we mint Auth.js session JWTs directly with next-auth/jwt's
 * encode() (salt "authjs.session-token" — the cookie salt Auth.js v5 uses
 * for JWT sessions over http) and talk to the API over HTTP, exactly like
 * a browser with a session cookie would.
 *
 * What it proves:
 *   - anonymous requests are rejected (401),
 *   - user A cannot READ user B's decks, stats or recent activity,
 *   - user A cannot WRITE study results into user B's deck/cards,
 *   - valid results are recorded and stats (overall/per-deck/streak) are
 *     computed correctly, including for decks that predate the feature
 *     (zeros, no crash),
 *   - deleting a deck cascades to its study results.
 *
 * Usage (server on $BASE_URL or spawned automatically):
 *   node scripts/auth-e2e.mjs                 # spawns `npm run start` (needs a build)
 *   NPM_CMD=dev node scripts/auth-e2e.mjs     # spawns `npm run dev` instead
 *   BASE_URL=http://127.0.0.1:3000 node scripts/auth-e2e.mjs   # use a running server
 *
 * Requires DATABASE_URL + AUTH_SECRET in the environment (or .env.local,
 * which Next loads for the spawned server).
 */
import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { encode } from "next-auth/jwt";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── Environment ──────────────────────────────────────────────────────────────
function loadEnvLocal() {
  try {
    for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  } catch {
    /* no .env.local — rely on the real environment */
  }
}
loadEnvLocal();

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const AUTH_SECRET = process.env.AUTH_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
assert.ok(AUTH_SECRET, "AUTH_SECRET must be set (same value the server uses)");
assert.ok(DATABASE_URL, "DATABASE_URL must be set (same database the server uses)");

const COOKIE = "authjs.session-token"; // http (non-secure) cookie name in Auth.js v5
const USER_A = "e2e-user-a-111111";
const USER_B = "e2e-user-b-222222";

/** Mint a session JWT for a user id, the way Auth.js would after Google sign-in. */
const sessionCookieFor = (userId) =>
  encode({
    token: {
      userId,
      sub: userId,
      email: `${userId}@e2e.local`,
      name: `E2E ${userId.slice(-1)}`,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      jti: `e2e-${userId}-${Date.now()}`,
    },
    secret: AUTH_SECRET,
    salt: "authjs.session-token",
  });

// ── HTTP helper ──────────────────────────────────────────────────────────────
async function api(path, { method = "GET", body, cookie } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: `${COOKIE}=${cookie}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, data };
}

// ── Database fixture ─────────────────────────────────────────────────────────
const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function seed() {
  // Clean slate for the two e2e users (cascades wipe their decks/results).
  await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [USER_A, USER_B]);
  await pool.query(
    `INSERT INTO users (id, email, name, provider) VALUES
       ($1, $2, 'E2E User A', 'google'),
       ($3, $4, 'E2E User B', 'google')`,
    [USER_A, "e2e-user-a@e2e.local", USER_B, "e2e-user-b@e2e.local"]
  );

  const mkSession = async (userId, title) => {
    const { rows } = await pool.query(
      `INSERT INTO study_sessions (title, source_type, user_id) VALUES ($1, 'text', $2) RETURNING id`,
      [title, userId]
    );
    return rows[0].id;
  };
  const mkCards = async (sessionId, n) => {
    const ids = [];
    for (let i = 1; i <= n; i++) {
      const { rows } = await pool.query(
        `INSERT INTO flashcards (session_id, question, answer, difficulty, order_index)
         VALUES ($1, $2, $3, 'medium', $4) RETURNING id`,
        [sessionId, `A: Question ${i} of deck ${sessionId}?`, `Answer ${i}`, i - 1]
      );
      ids.push(rows[0].id);
    }
    return ids;
  };

  return {
    a1: await mkSession(USER_A, "E2E Deck A1"),
    a2: await mkSession(USER_A, "E2E Deck A2 (untouched — predates stats)"),
    b1: await mkSession(USER_B, "E2E Deck B1"),
    mkCards,
  };
}

let tokenA;
let tokenB;
let deckA1;
let deckA2;
let deckB1;
let cardsA1;
let cardsB1;

let spawned = null;
async function waitForServer(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok || res.status === 401) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`server at ${BASE_URL} never came up`);
}

before(async () => {
  // Reuse a running server if there is one, otherwise spawn our own.
  let up = false;
  try {
    await fetch(`${BASE_URL}/api/health`);
    up = true;
  } catch {
    up = false;
  }
  if (!up) {
    const cmd = process.env.NPM_CMD ?? "start";
    spawned = spawn("npm", ["run", cmd], {
      cwd: root,
      env: { ...process.env, HOSTNAME: "0.0.0.0", PORT: String(new URL(BASE_URL).port || 3000) },
      stdio: "inherit",
    });
    await waitForServer();
  }

  const fixture = await seed();
  deckA1 = fixture.a1;
  deckA2 = fixture.a2;
  deckB1 = fixture.b1;
  cardsA1 = await fixture.mkCards(deckA1, 3);
  // A2 gets cards but is never answered — it stands in for the decks that
  // already existed before this feature (must render as zeros, not break).
  await fixture.mkCards(deckA2, 3);
  cardsB1 = await fixture.mkCards(deckB1, 2);

  tokenA = await sessionCookieFor(USER_A);
  tokenB = await sessionCookieFor(USER_B);
});

after(async () => {
  await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [USER_A, USER_B]);
  await pool.end();
  if (spawned) spawned.kill("SIGTERM");
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe("anonymous access", () => {
  test("GET /api/stats requires a session", async () => {
    const r = await api("/api/stats");
    assert.equal(r.status, 401);
  });

  test("POST /api/stats/results requires a session", async () => {
    const r = await api("/api/stats/results", {
      method: "POST",
      body: { results: [{ sessionId: deckA1, cardId: cardsA1[0], correct: true }] },
    });
    assert.equal(r.status, 401);
  });
});

describe("cross-user scoping (user A vs user B)", () => {
  test("A cannot see B's deck in GET /api/sessions", async () => {
    const r = await api("/api/sessions", { cookie: tokenA });
    assert.equal(r.status, 200);
    const ids = r.data.sessions.map((s) => s.id);
    assert.ok(ids.includes(deckA1) && ids.includes(deckA2));
    assert.ok(!ids.includes(deckB1), "B's deck leaked into A's session list");
  });

  test("A cannot load B's deck directly", async () => {
    const r = await api(`/api/sessions/${deckB1}`, { cookie: tokenA });
    assert.equal(r.status, 404);
  });

  test("A cannot record results into B's deck", async () => {
    const r = await api("/api/stats/results", {
      method: "POST",
      cookie: tokenA,
      body: { results: [{ sessionId: deckB1, cardId: cardsB1[0], correct: true }] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.recorded, 0);
    assert.equal(r.data.invalid.length, 1);
    assert.match(r.data.invalid[0].reason, /Session not found/);

    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM study_results WHERE session_id = $1`,
      [deckB1]
    );
    assert.equal(rows[0].n, 0, "A managed to write into B's deck");
  });

  test("A cannot record B's card under A's own deck id", async () => {
    const r = await api("/api/stats/results", {
      method: "POST",
      cookie: tokenA,
      body: { results: [{ sessionId: deckA1, cardId: cardsB1[0], correct: true }] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.recorded, 0);
    assert.match(r.data.invalid[0].reason, /Card not found in this session/);
  });

  test("mixed batch: A's valid row is recorded, B's rows are rejected", async () => {
    const r = await api("/api/stats/results", {
      method: "POST",
      cookie: tokenA,
      body: {
        results: [
          { sessionId: deckA1, cardId: cardsA1[0], correct: true, mode: "study" },
          { sessionId: deckB1, cardId: cardsB1[0], correct: true, mode: "exam" },
          { sessionId: deckB1, cardId: cardsB1[1], correct: false, mode: "exam" },
        ],
      },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.recorded, 1);
    assert.equal(r.data.invalid.length, 2);

    const { rows } = await pool.query(
      `SELECT user_id, card_id, correct, mode FROM study_results WHERE session_id = $1`,
      [deckA1]
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, USER_A);
    assert.equal(rows[0].card_id, cardsA1[0]);
    assert.equal(rows[0].correct, true);
    assert.equal(rows[0].mode, "study");
  });
});

describe("recording & validation", () => {
  test("empty results array is rejected", async () => {
    const r = await api("/api/stats/results", { method: "POST", cookie: tokenA, body: { results: [] } });
    assert.equal(r.status, 400);
  });

  test("bad shapes are rejected per-entry", async () => {
    const r = await api("/api/stats/results", {
      method: "POST",
      cookie: tokenA,
      body: {
        results: [
          { sessionId: "x", cardId: 1, correct: true },
          { sessionId: deckA1, cardId: cardsA1[1], correct: "yes" },
          { sessionId: deckA1, cardId: cardsA1[1], correct: false, mode: "cheating" },
        ],
      },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.recorded, 1, "the well-formed entry should still be recorded");
    assert.equal(r.data.invalid.length, 2);
    // Unknown mode falls back to 'study' rather than being rejected.
    const { rows } = await pool.query(
      `SELECT mode FROM study_results WHERE card_id = $1`,
      [cardsA1[1]]
    );
    assert.equal(rows[0].mode, "study");
  });

  test("batches over 100 are rejected", async () => {
    const results = Array.from({ length: 101 }, () => ({
      sessionId: deckA1,
      cardId: cardsA1[0],
      correct: true,
    }));
    const r = await api("/api/stats/results", { method: "POST", cookie: tokenA, body: { results } });
    assert.equal(r.status, 400);
  });
});

describe("stats correctness", () => {
  test("A's stats reflect A's answers only", async () => {
    // Add two more answers for A (one wrong) in exam mode.
    await api("/api/stats/results", {
      method: "POST",
      cookie: tokenA,
      body: {
        results: [
          { sessionId: deckA1, cardId: cardsA1[2], correct: false, mode: "exam" },
          { sessionId: deckA1, cardId: cardsA1[2], correct: true, mode: "exam" },
        ],
      },
    });

    const r = await api("/api/stats", { cookie: tokenA });
    assert.equal(r.status, 200);
    const { overall, decks, recent } = r.data;

    // A now has 4 answers: cardsA1[0] ✅, cardsA1[1] ❌, cardsA1[2] ❌ + ✅
    assert.equal(overall.totalAnswers, 4);
    assert.equal(overall.correctAnswers, 2);
    assert.equal(overall.incorrectAnswers, 2);
    assert.equal(overall.cardsStudied, 3);
    assert.equal(overall.studySessions, 1);
    assert.equal(overall.accuracy, 50);
    assert.equal(overall.streak, 1, "answers today ⇒ streak of 1");
    assert.ok(overall.lastStudiedAt);

    // Per deck: A1 has data, A2 (predates the feature) shows zeros.
    const a1 = decks.find((d) => d.sessionId === deckA1);
    const a2 = decks.find((d) => d.sessionId === deckA2);
    assert.ok(a1 && a2, "both of A's decks must be listed");
    assert.equal(a1.cardCount, 3);
    assert.equal(a1.studiedCount, 3);
    assert.equal(a1.answerCount, 4);
    assert.equal(a1.correctCount, 2);
    assert.equal(a1.mastery, 100);
    assert.equal(a1.accuracy, 50);
    assert.ok(a1.lastStudiedAt);
    assert.equal(a2.cardCount, 3);
    assert.equal(a2.studiedCount, 0);
    assert.equal(a2.answerCount, 0);
    assert.equal(a2.mastery, 0);
    assert.equal(a2.accuracy, null);
    assert.equal(a2.lastStudiedAt, null);

    // Recent activity: newest first, A's data only.
    assert.ok(recent.length >= 4);
    assert.ok(
      recent.every((x) => x.deckTitle.startsWith("E2E Deck A")),
      "recent activity leaked another user's deck"
    );
    const times = recent.map((x) => new Date(x.answeredAt).getTime());
    assert.deepEqual(times, [...times].sort((a, b) => b - a), "recent must be newest first");
  });

  test("B sees zeros for A's activity and none of A's decks", async () => {
    const r = await api("/api/stats", { cookie: tokenB });
    assert.equal(r.status, 200);
    const { overall, decks, recent } = r.data;
    assert.equal(overall.totalAnswers, 0);
    assert.equal(overall.cardsStudied, 0);
    assert.equal(overall.streak, 0);
    assert.equal(overall.accuracy, null);
    assert.deepEqual(
      decks.map((d) => d.sessionId),
      [deckB1],
      "B must see exactly B's deck"
    );
    assert.equal(decks[0].studiedCount, 0);
    assert.deepEqual(recent, []);
  });

  test("deleting a deck cascades to its study results", async () => {
    const del = await api(`/api/sessions/${deckA2}`, { method: "DELETE", cookie: tokenA });
    assert.equal(del.status, 200);
    const r = await api("/api/stats", { cookie: tokenA });
    assert.ok(!r.data.decks.some((d) => d.sessionId === deckA2));
  });
});

describe("daily streak", () => {
  const insertDay = (userId, sessionId, cardId, iso) =>
    pool.query(
      `INSERT INTO study_results (user_id, session_id, card_id, correct, mode, answered_at)
       VALUES ($1, $2, $3, true, 'study', $4::timestamp)`,
      [userId, sessionId, cardId, iso]
    );

  const utcDay = (offsetDays) => {
    const d = new Date(Date.now() + offsetDays * 86_400_000);
    return d.toISOString().slice(0, 10);
  };

  test("3 consecutive days ending today ⇒ streak 3", async () => {
    await pool.query(`DELETE FROM study_results WHERE user_id = $1`, [USER_A]);
    await insertDay(USER_A, deckA1, cardsA1[0], `${utcDay(-2)} 10:00:00`);
    await insertDay(USER_A, deckA1, cardsA1[1], `${utcDay(-1)} 10:00:00`);
    await insertDay(USER_A, deckA1, cardsA1[2], `${utcDay(0)} 10:00:00`);

    const r = await api("/api/stats", { cookie: tokenA });
    assert.equal(r.data.overall.streak, 3);
  });

  test("studied yesterday but not today ⇒ streak survives", async () => {
    await pool.query(`DELETE FROM study_results WHERE user_id = $1`, [USER_A]);
    await insertDay(USER_A, deckA1, cardsA1[0], `${utcDay(-2)} 10:00:00`);
    await insertDay(USER_A, deckA1, cardsA1[1], `${utcDay(-1)} 10:00:00`);

    const r = await api("/api/stats", { cookie: tokenA });
    assert.equal(r.data.overall.streak, 2);
  });

  test("a missed day resets the streak", async () => {
    await pool.query(`DELETE FROM study_results WHERE user_id = $1`, [USER_A]);
    await insertDay(USER_A, deckA1, cardsA1[0], `${utcDay(-3)} 10:00:00`);
    // gap at -2
    await insertDay(USER_A, deckA1, cardsA1[1], `${utcDay(-1)} 10:00:00`);
    await insertDay(USER_A, deckA1, cardsA1[2], `${utcDay(0)} 10:00:00`);

    const r = await api("/api/stats", { cookie: tokenA });
    assert.equal(r.data.overall.streak, 2, "only yesterday+today are consecutive");
  });

  test("last study 3 days ago ⇒ streak 0", async () => {
    await pool.query(`DELETE FROM study_results WHERE user_id = $1`, [USER_A]);
    await insertDay(USER_A, deckA1, cardsA1[0], `${utcDay(-3)} 10:00:00`);

    const r = await api("/api/stats", { cookie: tokenA });
    assert.equal(r.data.overall.streak, 0);
  });

  test("multiple answers on the same day count once", async () => {
    await pool.query(`DELETE FROM study_results WHERE user_id = $1`, [USER_A]);
    await insertDay(USER_A, deckA1, cardsA1[0], `${utcDay(0)} 08:00:00`);
    await insertDay(USER_A, deckA1, cardsA1[1], `${utcDay(0)} 12:00:00`);
    await insertDay(USER_A, deckA1, cardsA1[2], `${utcDay(0)} 20:00:00`);

    const r = await api("/api/stats", { cookie: tokenA });
    assert.equal(r.data.overall.streak, 1);
  });
});
