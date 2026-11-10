import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { isValidAuthEmail, normalizeAuthEmail } from "@/lib/auth-email";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid registration details" }, { status: 400 });
    }

    const { name, email, password } = body as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
    };

    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const normalizedEmail = normalizeAuthEmail(email);
    if (!isValidAuthEmail(normalizedEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 });
    }

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in instead." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `user_${crypto.randomUUID()}`;

    try {
      await db.insert(users).values({
        id: userId,
        email: normalizedEmail,
        name: typeof name === "string" && name.trim()
          ? name.trim()
          : normalizedEmail.split("@")[0],
        password: hashedPassword,
        provider: "credentials",
      });
    } catch (error) {
      let cause: unknown = error;
      while (cause && typeof cause === "object") {
        if ("code" in cause && cause.code === "23505") {
          return NextResponse.json(
            { error: "An account with this email already exists. Try signing in instead." },
            { status: 409 }
          );
        }
        cause = "cause" in cause ? cause.cause : undefined;
      }
      throw error;
    }

    return NextResponse.json({ success: true, message: "Account created successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
