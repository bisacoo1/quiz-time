"use client";

import { useEffect, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { CloudOff, FlaskConical, WifiOff, Mail, Lock, User, ArrowRight } from "lucide-react";
import {
  enableOfflineMode,
  isOfflineMode,
  probeConnection,
  readCachedProfile,
  type OfflineProfile,
} from "@/lib/offline";

const AUTH_ERRORS: Record<string, string> = {
  Configuration: "Sign-in isn't set up yet. Please try again later.",
  AccessDenied: "Google didn't allow this sign-in. Try another account.",
  Verification: "That sign-in link is no longer valid. Please try again.",
  OAuthAccountNotLinked: "This email is already used with a different sign-in method.",
  OAuthCallback: "Google sign-in didn't finish. Please try again.",
  Callback: "Sign-in didn't finish. Please try again.",
  CredentialsSignin: "Invalid email or password. Please try again.",
  Default: "Something went wrong signing in. Please try again.",
};

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function LoginPage({
  loading = false,
  error: errorCode,
}: {
  loading?: boolean;
  error?: string;
}) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(
    errorCode ? (AUTH_ERRORS[errorCode] ?? AUTH_ERRORS.Default) : null
  );

  const [authMode, setAuthMode] = useState<"choose" | "email-signin" | "email-signup">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState("");

  const [cached, setCached] = useState<OfflineProfile | null>(null);
  const [offlineAvailable, setOfflineAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [browserOffline, setBrowserOffline] = useState(false);

  const [demoLogin, setDemoLogin] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (alive) setDemoLogin(Boolean(data.demoLogin));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const sync = () => setBrowserOffline(navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    void (async () => {
      const profile = await readCachedProfile();
      if (!alive) return;
      setCached(profile);
      setOfflineAvailable(Boolean(profile) || isOfflineMode());
    })();
    return () => {
      alive = false;
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const handleGoogleSignIn = () => {
    setSigningIn(true);
    void signIn("google", { callbackUrl: "/" }).catch(() => {
      setSigningIn(false);
      setError(AUTH_ERRORS.Default);
    });
  };

  const handleDemoSignIn = () => {
    setSigningIn(true);
    void signIn("demo", { callbackUrl: "/" }).catch(() => {
      setSigningIn(false);
      setError(AUTH_ERRORS.Default);
    });
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!email || !password) {
      setFormError("Please fill in all fields.");
      return;
    }

    setSigningIn(true);

    if (authMode === "email-signup") {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to create account");
        }
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Registration failed");
        setSigningIn(false);
        return;
      }
    }

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setFormError(AUTH_ERRORS[result.error] ?? result.error ?? "Invalid email or password.");
        setSigningIn(false);
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : AUTH_ERRORS.Default);
      setSigningIn(false);
    }
  };

  const continueOffline = () => {
    enableOfflineMode(true);
    window.location.replace("/");
  };

  const tryConnection = async () => {
    setChecking(true);
    try {
      const online = await probeConnection();
      if (online) {
        window.location.reload();
        return;
      }
      setError("Still no connection. Check your Wi-Fi or mobile data.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="login-screen">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/logo.png"
        alt="QuizTime — Flashcard Quiz Maker"
        className="login-logo animate-fade-in"
      />

      <div className="login-panel glass-card animate-slide-up">
        {loading ? (
          <>
            <div className="spinner" style={{ margin: "8px auto 16px" }} />
            <p className="login-copy">Loading QuizTime…</p>
          </>
        ) : (
          <>
            <h1 className="login-title">Welcome to QuizTime</h1>
            <p className="login-copy">
              Sign in to turn your notes into flashcards and study with Exam,
              Identification and Enumeration modes.
            </p>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            {offlineAvailable && (
              <div
                style={{
                  margin: "0 0 14px",
                  background: browserOffline ? "#fff7ed" : "#eff6ff",
                  border: `1.5px solid ${browserOffline ? "#fed7aa" : "#bfdbfe"}`,
                  borderRadius: 16,
                  padding: "12px 14px",
                  textAlign: "left",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    color: browserOffline ? "#9a3412" : "#1e40af",
                    flexShrink: 0,
                    display: "flex",
                    marginTop: 1,
                  }}
                  aria-hidden
                >
                  {browserOffline ? <WifiOff size={18} /> : <CloudOff size={18} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>
                    {browserOffline ? "You're offline" : "Study without signing in"}
                  </p>
                  <p style={{ margin: "2px 0 8px", fontSize: 12.5, color: "var(--text-muted)" }}>
                    {cached?.name
                      ? `${cached.name} — the sets saved on this device are ready to study.`
                      : "The sets saved on this device are ready to study."}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={continueOffline}>
                      <CloudOff />
                      Continue offline
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void tryConnection()}
                      disabled={checking}
                    >
                      {checking ? "Checking…" : "Check connection"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {authMode === "choose" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  className="btn btn-lg login-google"
                  onClick={handleGoogleSignIn}
                  disabled={signingIn}
                >
                  <GoogleMark />
                  Continue with Google
                </button>

                <button
                  className="btn btn-secondary btn-lg"
                  style={{ width: "100%" }}
                  onClick={() => setAuthMode("email-signin")}
                  disabled={signingIn}
                >
                  <Mail size={18} />
                  Sign in with Email & Password
                </button>

                <button
                  className="btn btn-ghost btn-md"
                  style={{ width: "100%", marginTop: 4 }}
                  onClick={() => setAuthMode("email-signup")}
                  disabled={signingIn}
                >
                  Create an account <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                    {authMode === "email-signup" ? "Create an Account" : "Sign In with Email"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => { setAuthMode("choose"); setFormError(""); }}
                    style={{ background: "none", border: "none", color: "var(--blue-dark)", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                  >
                    Back to options
                  </button>
                </div>

                {formError && (
                  <p className="login-error" role="alert" style={{ margin: 0 }}>
                    {formError}
                  </p>
                )}

                {authMode === "email-signup" && (
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: "var(--text-muted)" }}>
                      Full Name
                    </label>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <User size={16} style={{ position: "absolute", left: 12, color: "var(--text-muted)" }} />
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 12px 10px 36px",
                          borderRadius: 12,
                          border: "1px solid var(--border-color)",
                          background: "var(--bg-subtle, #f9fafb)",
                          fontSize: 14,
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: "var(--text-muted)" }}>
                    Email Address
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <Mail size={16} style={{ position: "absolute", left: 12, color: "var(--text-muted)" }} />
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 36px",
                        borderRadius: 12,
                        border: "1px solid var(--border-color)",
                        background: "var(--bg-subtle, #f9fafb)",
                        fontSize: 14,
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4, color: "var(--text-muted)" }}>
                    Password {authMode === "email-signup" && "(at least 6 characters)"}
                  </label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <Lock size={16} style={{ position: "absolute", left: 12, color: "var(--text-muted)" }} />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 36px",
                        borderRadius: 12,
                        border: "1px solid var(--border-color)",
                        background: "var(--bg-subtle, #f9fafb)",
                        fontSize: 14,
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: "100%", marginTop: 4 }}
                  disabled={signingIn}
                >
                  {signingIn ? (
                    <>
                      <div
                        className="spinner"
                        style={{
                          width: 20,
                          height: 20,
                          borderWidth: 2.5,
                          borderColor: "rgba(255,255,255,0.2)",
                          borderTopColor: "#fff",
                        }}
                      />
                      {authMode === "email-signup" ? "Creating account…" : "Signing in…"}
                    </>
                  ) : (
                    <>{authMode === "email-signup" ? "Create Account" : "Sign In"}</>
                  )}
                </button>
              </form>
            )}

            {demoLogin && authMode === "choose" && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    margin: "16px 0",
                  }}
                >
                  <div style={{ flex: 1, height: 1, background: "rgba(147,197,253,0.4)" }} />
                  <span className="login-footnote" style={{ margin: 0 }}>or</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(147,197,253,0.4)" }} />
                </div>
                <button
                  className="btn btn-secondary btn-lg"
                  style={{ width: "100%" }}
                  onClick={handleDemoSignIn}
                  disabled={signingIn}
                >
                  <FlaskConical />
                  Try it as a demo student
                </button>
                <p className="login-footnote" style={{ marginTop: 8 }}>
                  Demo mode is on for this server — it opens a local test
                  account, no Google needed.
                </p>
              </>
            )}

            <p className="login-footnote" style={{ marginTop: 16 }}>
              Free · your decks stay in your account
            </p>
          </>
        )}
      </div>

      <p className="login-developer">Developed by: FBC BSIT 3-A</p>
    </main>
  );
}
