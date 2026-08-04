"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, HeartHandshake, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/context/auth-context";
import { useAppData, type ActionResult } from "@/lib/context/data-context";

export default function CheckInPage() {
  return (
    <Suspense fallback={null}>
      <CheckInFlow />
    </Suspense>
  );
}

/**
 * Scanning the event's QR code lands here with the token in the URL.
 *
 * The token is sent straight to the server, which is the only party that
 * can resolve it — students have no read access to the qr_tokens table.
 * Everything shown below (including which event this was) comes back from
 * that verified response rather than from a client-side lookup.
 */
function CheckInFlow() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const { currentUser, loading } = useAuth();
  const { checkIn } = useAppData();

  const [result, setResult] = useState<(ActionResult & { title?: string }) | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (loading || attempted.current || !currentUser) return;
    attempted.current = true;

    if (currentUser.role !== "student") {
      setResult({ ok: false, reason: "Only student accounts can check in to events." });
      return;
    }
    if (!token) {
      setResult({ ok: false, reason: "This link is missing its check-in code. Try scanning the QR code again." });
      return;
    }

    void checkIn(token).then((res) => setResult(res as ActionResult & { title?: string }));
  }, [loading, currentUser, token, checkIn]);

  if (loading) return null;

  if (!currentUser) {
    return (
      <CenterShell>
        <p className="font-display text-lg font-semibold text-navy-900">Log in to check in</p>
        <p className="mt-2 text-sm text-navy-500">
          You&apos;ll need to be logged in to your student account to confirm attendance.
        </p>
        <Link href={`/login?next=${encodeURIComponent(`/checkin?token=${token}`)}`} className="mt-6 inline-block">
          <Button>Log in</Button>
        </Link>
      </CenterShell>
    );
  }

  if (!result) {
    return (
      <CenterShell>
        <p className="text-sm text-navy-500">Confirming your attendance…</p>
      </CenterShell>
    );
  }

  return (
    <CenterShell>
      {result.ok ? (
        <>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <p className="mt-4 font-display text-xl font-bold text-navy-900">You&apos;re checked in!</p>
          {result.title && <p className="mt-1.5 text-sm text-navy-500">{result.title}</p>}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-navy-400">
            <Clock className="h-3.5 w-3.5" />
            Arrival time recorded just now
          </p>
          <p className="mt-4 text-sm text-navy-500">
            The organization will verify your completed hours after the event.
          </p>
        </>
      ) : (
        <>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <p className="mt-4 font-display text-xl font-bold text-navy-900">Check-in didn&apos;t go through</p>
          <p className="mt-1.5 text-sm text-navy-500">{result.reason}</p>
          {result.code === "membership-required" && (
            <Link href="/dashboard/student" className="mt-5 inline-block">
              <Button>Activate membership</Button>
            </Link>
          )}
        </>
      )}
      <Link href="/dashboard/student" className="mt-6 inline-block">
        <Button variant="outline">Go to dashboard</Button>
      </Link>
    </CenterShell>
  );
}

function CenterShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
      <div className="mb-6 flex items-center gap-2 font-display text-lg font-bold text-navy-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-white">
          <HeartHandshake className="h-4.5 w-4.5" />
        </span>
        Volunteerly
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-navy-100 bg-white p-8 shadow-card">{children}</div>
    </div>
  );
}
