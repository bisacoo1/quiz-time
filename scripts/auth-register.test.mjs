import test, { beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

let existingUser = null;
let insertedUser = null;

mock.module("../src/db/index.ts", {
  namedExports: {
    db: {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  limit: async () => (existingUser ? [existingUser] : []),
                };
              },
            };
          },
        };
      },
      insert() {
        return {
          values: async (value) => {
            insertedUser = value;
          },
        };
      },
    },
  },
});

const { POST } = await import("../src/app/api/auth/register/route.ts");

beforeEach(() => {
  existingUser = null;
  insertedUser = null;
});

async function register(payload) {
  const response = await POST(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
  return { status: response.status, body: await response.json() };
}

test("registers Gmail credentials using a normalized email", async () => {
  const { status, body } = await register({
    name: "Jane Doe",
    email: "  Jane.Doe+study@GMAIL.COM ",
    password: "correct-horse",
  });

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(insertedUser.email, "jane.doe+study@gmail.com");
  assert.equal(insertedUser.name, "Jane Doe");
  assert.match(insertedUser.password, /^\$2[aby]\$/);
  assert.equal(insertedUser.provider, "credentials");
});

test("rejects malformed email addresses before database access", async () => {
  const { status, body } = await register({
    email: "not-an-email",
    password: "correct-horse",
  });

  assert.equal(status, 400);
  assert.match(body.error, /valid email/i);
  assert.equal(insertedUser, null);
});

test("reports an existing email instead of creating another account", async () => {
  existingUser = { id: "existing-user" };

  const { status, body } = await register({
    email: "jane.doe@gmail.com",
    password: "correct-horse",
  });

  assert.equal(status, 409);
  assert.match(body.error, /already exists/i);
  assert.equal(insertedUser, null);
});
