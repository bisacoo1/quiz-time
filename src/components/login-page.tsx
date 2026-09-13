"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

const AUTH_ERRORS: Record<string, string> = {
  Configuration: "Sign-in isn't set up yet. Please try again later.",
  AccessDenied: "Google didn't allow this sign-in. Try another account.",
  Verification: "That sign-in link is no longer valid. Please try again.",
  OAuthAccountNotLinked: "This email is already used with a different sign-in method.",
  OAuthCallback: "Google sign-in didn't finish. Please try again.",
  Callback: "Sign-in didn't finish. Please try again.",
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

/**
 * Full-screen login shown to visitors before the rest of the app.
 * The QuizTime logo is the hero — sized large so it reads as the brand,
 * not a tiny favicon.
 */
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

  const handleSignIn = () => {
    setSigningIn(true);
    void signIn("google", { callbackUrl: "/" }).catch(() => {
      setSigningIn(false);
      setError(AUTH_ERRORS.Default);
    });
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

            <button
              className="btn btn-lg login-google"
              onClick={handleSignIn}
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
                      borderColor: "rgba(29,78,216,0.2)",
                      borderTopColor: "var(--blue-dark)",
                    }}
                  />
                  Redirecting to Google…
                </>
              ) : (
                <>
                  <GoogleMark />
                  Continue with Google
                </>
              )}
            </button>

            <p className="login-footnote">
              Free · no password to remember · your decks stay in your account
            </p>
          </>
        )}
      </div>

      <p className="login-developer">Developed by: John Lloyd Ambrad</p>
    </main>
  );
}
