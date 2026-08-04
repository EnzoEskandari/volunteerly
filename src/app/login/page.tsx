"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HeartHandshake, ArrowRight, ShieldCheck, Clock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useAuth } from "@/lib/context/auth-context";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { loginWithEmail, loginWithGoogle, sendPasswordReset } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const result = await loginWithEmail(email, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.reason ?? "Something went wrong.");
      return;
    }
    // Middleware sends each role to its own dashboard from here.
    router.push(params.get("next") ?? "/dashboard/student");
    router.refresh();
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await sendPasswordReset(email);
    setLoading(false);
    if (!result.ok) {
      setError(result.reason ?? "Couldn't send that reset link.");
      return;
    }
    // Worded so it doesn't reveal whether an account exists for that address.
    setNotice("If an account exists for that email, a reset link is on its way.");
    setResetMode(false);
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20">
        <Link href="/" className="mb-10 flex items-center gap-2 font-display text-lg font-bold text-navy-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-white">
            <HeartHandshake className="h-4.5 w-4.5" />
          </span>
          Volunteerly
        </Link>

        <div className="mx-auto w-full max-w-sm">
          <h1 className="font-display text-2xl font-bold text-navy-900">
            {resetMode ? "Reset your password" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-sm text-navy-500">
            {resetMode
              ? "Enter your email and we'll send you a link to set a new password."
              : "Log in to continue your volunteer journey."}
          </p>

          <form onSubmit={resetMode ? handleReset : handleSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {!resetMode && (
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(true);
                    setError(null);
                  }}
                  className="mt-1.5 inline-block text-xs font-medium text-brand hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {notice && <p className="text-sm text-emerald-600">{notice}</p>}

            <Button type="submit" className="w-full group" loading={loading}>
              {resetMode ? "Send reset link" : "Log in"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>

            {resetMode && (
              <button
                type="button"
                onClick={() => setResetMode(false)}
                className="w-full text-center text-sm font-medium text-navy-500 hover:text-navy-700"
              >
                Back to log in
              </button>
            )}
          </form>

          {!resetMode && (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-navy-100" />
                <span className="text-xs text-navy-400">or</span>
                <div className="h-px flex-1 bg-navy-100" />
              </div>

              <Button variant="outline" className="w-full" onClick={() => void loginWithGoogle()} type="button">
                <GoogleIcon />
                Continue with Google
              </Button>

              <p className="mt-6 text-center text-sm text-navy-500">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="font-medium text-brand hover:underline">
                  Sign up
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      {/* What the product actually does — stated plainly. No testimonial
          appears here until there is a real student willing to be quoted. */}
      <div className="relative hidden w-1/2 items-center justify-center bg-navy-950 lg:flex">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(600px circle at 30% 30%, rgba(37,99,235,0.35), transparent 60%), radial-gradient(500px circle at 80% 80%, rgba(16,185,129,0.25), transparent 55%)",
          }}
        />
        <div className="relative max-w-sm px-8">
          <h2 className="font-display text-2xl font-semibold leading-snug text-white">
            Service hours you can actually prove.
          </h2>
          <ul className="mt-8 space-y-5">
            {[
              { icon: Clock, text: "Check in by QR code at the event — no paper sign-in sheets." },
              { icon: ShieldCheck, text: "Hours are verified by the organization and locked permanently." },
              { icon: Award, text: "Download a transcript whenever a scholarship asks for one." },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-sm leading-relaxed text-navy-200">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}
