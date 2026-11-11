import test, { beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

let dailyCount = 0;
let capturedRequest = null;
let upstreamResponse = null;

mock.module("../src/lib/auth-guard.ts", {
  namedExports: {
    requireUser: async () => ({ user: { id: "youtube-test-user" } }),
  },
});
mock.module("../src/lib/rate-limit.ts", {
  namedExports: {
    isRateLimited: () => false,
  },
});
mock.module("../src/db/index.ts", {
  namedExports: {
    pool: {
      async query(sql, params) {
        assert.match(sql, /INSERT INTO youtube_generation_usage/);
        assert.equal(params[0], "youtube-test-user");
        if (dailyCount >= 5) return { rows: [], rowCount: 0 };
        dailyCount += 1;
        return { rows: [{ count: dailyCount }], rowCount: 1 };
      },
    },
  },
});

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  capturedRequest = { url: String(url), options, body: JSON.parse(options.body) };
  return upstreamResponse;
};

const { POST } = await import("../src/app/api/youtube/route.ts");

beforeEach(() => {
  dailyCount = 0;
  capturedRequest = null;
  upstreamResponse = new Response(
    JSON.stringify({
      output_text: JSON.stringify({
        title: "Cell Biology Lecture",
        summary: "A brief overview of mitochondria.",
        cards: [
          {
            question: "What do mitochondria produce?",
            answer: "Most of the cell's ATP.",
            hint: "Think cellular energy.",
            difficulty: "easy",
          },
        ],
      }),
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
  process.env.GEMINI_VIDEO_API_KEY = "test-video-key";
});

async function post(body) {
  return POST(
    new Request("http://localhost/api/youtube", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

test("sends a canonical public YouTube URL to Gemini and returns a study set", async () => {
  const response = await post({
    url: "https://youtu.be/dQw4w9WgXcQ?t=10",
    course: "Biology",
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.title, "Cell Biology Lecture");
  assert.equal(body.cards.length, 1);
  assert.equal(body.sourceUrl, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(body.dailyLimit, 5);
  assert.equal(body.remainingToday, 4);
  assert.equal(capturedRequest.url, "https://generativelanguage.googleapis.com/v1beta/interactions");
  assert.equal(capturedRequest.options.headers["x-goog-api-key"], "test-video-key");
  assert.deepEqual(capturedRequest.body.input[1], {
    type: "video",
    uri: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  });
  assert.match(capturedRequest.body.input[0].text, /summary and 8 to 12 useful flashcards/i);
});

test("rejects unsupported URLs without consuming the daily video limit", async () => {
  const response = await post({ url: "https://example.com/video" });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /valid YouTube video link/i);
  assert.equal(dailyCount, 0);
  assert.equal(capturedRequest, null);
});

test("enforces five video generations per user per UTC day", async () => {
  dailyCount = 5;
  const response = await post({ url: "https://youtu.be/dQw4w9WgXcQ" });
  const body = await response.json();

  assert.equal(response.status, 429);
  assert.equal(body.remainingToday, 0);
  assert.match(body.error, /5 YouTube videos per day/);
  assert.equal(capturedRequest, null);
});

test.after(() => {
  globalThis.fetch = realFetch;
  delete process.env.GEMINI_VIDEO_API_KEY;
});
