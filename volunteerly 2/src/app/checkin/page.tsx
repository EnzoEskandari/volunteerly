"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, HeartHandshake, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/context/auth-context";
import { useAppData } from "@/lib/context/data-context";
import { formatDate } from "@/lib/utils";

export default function CheckInPage() {
  return (
    <Suspense fallback={null}>
      <CheckInFlow />
    </Suspense>
  );
}

function CheckInFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const { currentUser, loading } = useAuth();
  const { checkIn, opportunities, qrTokens } = useAppData();

  const [result, setResult] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [ranOnce, setRanOnce] = useState(false);

  useEffect(() => {
    if (loading || ranOnce || !currentUser) return;
    if (currentUser.role !== "student") {
      setResult({ ok: false, reason: "Only student accounts can check in to events." });
      setRanOnce(true);
      return;
    }
    const res = checkIn(currentUser.id, token);
    setResult(res);
    setRanOnce(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, currentUser, ranOnce]);

  const qrRecord = qrTokens.find((q) => q.token === token);
  const opp = opportunities.find((o) => o.id === qrRecord?.opportunityId);

  if (loading) return null;

  if (!currentUser) {
    return (
      <CenterShell>
        <p className="font-display text-lg font-semibold text-navy-900">Log in to check in</p>
        <p className="mt-2 text-sm text-navy-500">
          You'll need to be logged in to your student account to confirm attendance.
        </p>
        <Link href={`/login?redirect=${encodeURIComponent(`/checkin?token=${token}`)}`} className="mt-6 inline-block">
          <Button>Log in</Button>
        </Link>
      </CenterShell>
    );
  }

  if (!ranOnce || !result) {
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
          <p className="mt-4 font-display text-xl font-bold text-navy-900">You're checked in!</p>
          {opp && (
            <p className="mt-1.5 text-sm text-navy-500">
              {opp.title} · {formatDate(opp.date)}
            </p>
          )}
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
          <p className="mt-4 font-display text-xl font-bold text-navy-900">Check-in didn't go through</p>
          <p className="mt-1.5 text-sm text-navy-500">{result.reason}</p>
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
