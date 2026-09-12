import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Auth.js (v5) — Google OAuth with JWT sessions.
 *
 * JWT (not database) sessions keep every request stateless, which suits
 * serverless hosting. On first sign-in we upsert the profile into our
 * own `users` table and pin the user id into the token, so API routes
 * can scope every query to the signed-in user.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  // The app runs behind proxies (Vercel, preview tunnels, local e2e), where
  // the Host header doesn't match a configured AUTH_URL. Without this,
  // Auth.js v5 throws UntrustedHost and every auth() call — and therefore
  // every signed-in API route — fails with 401/500.
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      // `user` is only present on the first callback right after sign-in.
      // (In Auth.js v5 types, `id` is optional — Google always provides it.)
      if (user && user.id) {
        // `provider` lives on the AdapterUser half of the union.
        const provider = (user as { provider?: string }).provider ?? "google";
        // Google always sends an email for accounts it lets you sign in
        // with, but fall back to a synthetic one so the NOT NULL column
        // never breaks a login.
        const email = user.email ?? `${user.id}@${provider}.local`;
        const [row] = await db
          .insert(users)
          .values({
            id: user.id,
            email,
            name: user.name ?? null,
            image: user.image ?? null,
            provider,
          })
          .onConflictDoUpdate({
            target: users.id,
            set: {
              email,
              name: user.name ?? null,
              image: user.image ?? null,
            },
          })
          .returning();
        if (row) token.userId = row.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId;
      }
      return session;
    },
  },
});

// ── Type augmentation ───────────────────────────────────────────────────────
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
  }
}
