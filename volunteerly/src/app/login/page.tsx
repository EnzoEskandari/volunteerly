"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HeartHandshake, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useAuth } from "@/lib/context/auth-context";
import { dashboardPathForRole } from "@/lib/routes";
import { isMockMode } from "@/lib/mode";
import { CURRENT_STUDENT_ID, CURRENT_ORG_ID, CURRENT_ADMIN_ID } from "@/lib/mock-data";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { loginWithEmail, loginAsDemo, loginWithGoogle } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await loginWithEmail(email, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.reason ?? "Something went wrong.");
      return;
    }
    router.push(params.get("redirectRole") ? dashboardPathForRole(params.get("redirectRole") as any) : "/");
  };

  const demoLogin = (id: string) => {
    loginAsDemo(id);
    router.push("/");
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
          <h1 className="font-display text-2xl font-bold text-navy-900">Welcome back</h1>
          <p className="mt-1.5 text-sm text-navy-500">Log in to continue your volunteer journey.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Link href="#" className="mt-1.5 inline-block text-xs font-medium text-brand hover:underline">
                Forgot password?
              </Link>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full group" loading={loading}>
              Log in
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-navy-100" />
            <span className="text-xs text-navy-400">or</span>
            <div className="h-px flex-1 bg-navy-100" />
          </div>

          <Button variant="outline" className="w-full" onClick={loginWithGoogle} type="button">
            <GoogleIcon />
            Continue with Google
          </Button>

          <p className="mt-6 text-center text-sm text-navy-500">
            Don't have an account?{" "}
            <Link href="/register" className="font-medium text-brand hover:underline">
              Sign up
            </Link>
          </p>

          {isMockMode() && (
            <div className="mt-10 rounded-xl border border-dashed border-navy-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy-400">Try a demo account</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  onClick={() => demoLogin(CURRENT_STUDENT_ID)}
                  className="rounded-lg border border-navy-100 px-2 py-2 text-xs font-medium text-navy-700 hover:bg-navy-50"
                >
                  Student
                </button>
                <button
                  onClick={() => demoLogin(CURRENT_ORG_ID)}
                  className="rounded-lg border border-navy-100 px-2 py-2 text-xs font-medium text-navy-700 hover:bg-navy-50"
                >
                  Nonprofit
                </button>
                <button
                  onClick={() => demoLogin(CURRENT_ADMIN_ID)}
                  className="rounded-lg border border-navy-100 px-2 py-2 text-xs font-medium text-navy-700 hover:bg-navy-50"
                >
                  Admin
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative hidden w-1/2 items-center justify-center bg-navy-950 lg:flex">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(600px circle at 30% 30%, rgba(37,99,235,0.35), transparent 60%), radial-gradient(500px circle at 80% 80%, rgba(16,185,129,0.25), transparent 55%)",
          }}
        />
        <blockquote className="relative max-w-md px-8 text-center">
          <p className="font-display text-2xl font-medium leading-snug text-white">
            "Everything is verified and in one place before I even get home."
          </p>
          <p className="mt-4 text-sm text-navy-300">— Elena Vasquez, Junior at Dos Pueblos High School</p>
        </blockquote>
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
