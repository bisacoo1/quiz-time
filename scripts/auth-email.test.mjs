import test from "node:test";
import assert from "node:assert/strict";

import { isValidAuthEmail, normalizeAuthEmail } from "../src/lib/auth-email.ts";

test("normalizes Gmail addresses independent of capitalization and whitespace", () => {
  assert.equal(normalizeAuthEmail("  Jane.Doe+study@GMAIL.COM "), "jane.doe+study@gmail.com");
  assert.equal(isValidAuthEmail(normalizeAuthEmail("  Jane.Doe+study@GMAIL.COM ")), true);
});

test("rejects malformed email addresses", () => {
  for (const email of ["", "not-an-email", "missing-domain@", "@gmail.com", "a b@gmail.com"]) {
    assert.equal(isValidAuthEmail(normalizeAuthEmail(email)), false, email);
  }
});
