"use client";

import { useState } from "react";
import { Printer, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Print / copy-link controls. Hidden when the page is actually printed. */
export function CertificateActions({ verifyUrl }: { verifyUrl: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context or denied permission) — the URL
      // is printed on the certificate itself, so this is a convenience only.
    }
  };

  return (
    <div className="flex flex-wrap justify-center gap-2 print:hidden">
      <Button variant="outline" size="sm" onClick={() => void copy()}>
        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Link2 className="h-4 w-4" />}
        {copied ? "Link copied" : "Copy verification link"}
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        Print / Save as PDF
      </Button>
    </div>
  );
}
