"use client";

import { signIn } from "next-auth/react";
import { Wrench } from "lucide-react";

/**
 * Full-page maintenance screen shown to signed-out visitors while
 * MAINTENANCE_MODE is on. Rendered by the root layout (server-side), but
 * the sign-in button needs the client-side next-auth helper so owners can
 * still get in while the site is in maintenance.
 */
export function MaintenanceScreen() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="glass-card animate-slide-up"
        style={{
          maxWidth: 420,
          width: "100%",
          padding: "40px 32px",
          textAlign: "center",
        }}
      >
        <div style={{ lineHeight: 1, color: "var(--accent-dark)" }} aria-hidden>
          <Wrench size={56} strokeWidth={1.5} />
        </div>
        <h1
          className="gradient-text"
          style={{ fontSize: 26, fontWeight: 800, margin: "16px 0 8px" }}
        >
          We&rsquo;ll be right back!
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15, lineHeight: 1.6, margin: "0 0 8px" }}>
          QuizTime is down for maintenance right now. Your decks and progress
          are safe — please check back a little later.
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 24px" }}>
          Owner? Sign in to keep using the site while maintenance is on.
        </p>
        <button
          className="btn btn-primary btn-lg"
          style={{ width: "100%" }}
          onClick={() => void signIn("google", { callbackUrl: window.location.href })}
        >
          Sign in with Google
        </button>
      </div>
    </main>
  );
}
