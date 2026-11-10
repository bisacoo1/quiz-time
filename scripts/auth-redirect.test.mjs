import test from "node:test";
import assert from "node:assert/strict";

import { resolveAuthRedirect } from "../src/lib/auth-redirect.ts";

const baseUrl = "https://quiztime.example";

test("resolves relative callback URLs to absolute URLs", () => {
  assert.equal(resolveAuthRedirect("/", baseUrl), `${baseUrl}/`);
  assert.equal(
    resolveAuthRedirect("/study?session=42#cards", baseUrl),
    `${baseUrl}/study?session=42#cards`
  );
});

test("keeps absolute redirects on the same origin", () => {
  assert.equal(
    resolveAuthRedirect("https://quiztime.example/study", baseUrl),
    "https://quiztime.example/study"
  );
});

test("rejects external or malformed redirect targets", () => {
  assert.equal(resolveAuthRedirect("https://attacker.example", baseUrl), `${baseUrl}/`);
  assert.equal(resolveAuthRedirect("http://[invalid", baseUrl), `${baseUrl}/`);
});
