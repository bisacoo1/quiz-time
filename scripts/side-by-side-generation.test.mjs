import test, { mock } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgres://test:test@localhost:5432/quiztime";
process.env.GEMINI_API_KEY = "test-key";
process.env.OPENROUTER_API_KEY = "";

mock.module("../src/lib/auth-guard.ts", {
  namedExports: {
    requireUser: async () => ({ user: { id: "user-1", name: "Test", image: null } }),
  },
});
mock.module("../src/lib/rate-limit.ts", {
  namedExports: {
    isRateLimited: () => false,
    clientIp: () => "127.0.0.1",
  },
});

const generated = {
  title: "Mitosis review",
  summary: "Review the phases of mitosis.",
  cards: [
    {
      question: "What are the four phases of mitosis?",
      answer: "Prophase, metaphase, anaphase, and telophase.",
      difficulty: "easy",
    },
  ],
};

let capturedPrompt = "";
const realFetch = globalThis.fetch;
globalThis.fetch = async (_url, options) => {
  const request = JSON.parse(options.body);
  capturedPrompt = request.contents
    .flatMap((content) => content.parts.map((part) => part.text ?? ""))
    .join("\n");
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: { parts: [{ text: JSON.stringify(generated) }], role: "model" },
          finishReason: "STOP",
          index: 0,
        },
      ],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
};

const { POST } = await import("../src/app/api/scan/route.ts");

test("generates reviewed-card drafts from only selected Side by Side highlights", async () => {
  const selectedSource = JSON.stringify({
    document: "Biology notes.pdf",
    highlights: [
      { quote: "Mitosis has four phases.", note: "Remember the order." },
    ],
  });
  const form = new FormData();
  form.set("source", "side-by-side-highlights");
  form.set("text", selectedSource);

  const response = await POST(
    new Request("http://localhost/api/scan", { method: "POST", body: form })
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.title, generated.title);
  assert.equal(body.cards.length, 1);
  assert.equal(body.cards[0].hint, "");
  assert.equal(body.cards[0].difficulty, "easy");
  assert.match(capturedPrompt, /selected document highlights/);
  assert.match(capturedPrompt, /Mitosis has four phases/);
  assert.match(capturedPrompt, /Remember the order/);
  assert.match(capturedPrompt, /no more than 12 cards/);
});

test.after(() => {
  globalThis.fetch = realFetch;
});
