"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowRight, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { normalizeCertificateNumber, CERTIFICATE_EXAMPLE } from "@/lib/certificate-number";

/**
 * Where someone holding a printed certificate goes to check it.
 *
 * The number is normalised before navigating, so a hand-typed entry with
 * missing dashes or the wrong case still resolves instead of bouncing off
 * a strict format check.
 */
export default function VerifyLookupPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeCertificateNumber(value);
    if (!normalized) {
      setError("That doesn't look like a Volunteerly certificate number. Check it and try again.");
      return;
    }
    router.push(`/verify/${normalized}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-navy-100 bg-white p-8 shadow-card">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy-900 text-white">
          <ShieldCheck className="h-6 w-6" />
        </div>

        <h1 className="mt-5 font-display text-2xl font-bold text-navy-900">Verify a certificate</h1>
        <p className="mt-2 text-sm leading-relaxed text-navy-500">
          Enter the certificate number from a Volunteerly service record to confirm it&apos;s genuine and
          see the organization that attested to it.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="certificate">Certificate number</Label>
            <Input
              id="certificate"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              placeholder={CERTIFICATE_EXAMPLE}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" className="group w-full">
            Verify
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </form>

        <p className="mt-5 text-xs leading-relaxed text-navy-400">
          Volunteerly records are written by the nonprofit that supervised the service and are permanently
          locked once issued — neither the volunteer nor the organization can change them afterwards.
        </p>
      </div>

      <Link
        href="/"
        className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-navy-400 transition-colors hover:text-navy-700"
      >
        <HeartHandshake className="h-4 w-4" />
        Volunteerly
      </Link>
    </main>
  );
}
