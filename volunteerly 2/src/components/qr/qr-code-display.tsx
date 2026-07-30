"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { VolunteerOpportunity, QRToken } from "@/lib/types";

export function QRCodeDisplay({ opp, qrToken }: { opp: VolunteerOpportunity; qrToken: QRToken }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const checkinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/checkin?token=${qrToken.token}`
      : `/checkin?token=${qrToken.token}`;

  useEffect(() => {
    QRCode.toDataURL(checkinUrl, { width: 320, margin: 1, color: { dark: "#0F172A", light: "#FFFFFF" } })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrToken.token]);

  const expired = new Date(qrToken.expiresAt).getTime() < Date.now();

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${opp.title.replace(/\s+/g, "_")}_QR.png`;
    a.click();
  };

  return (
    <Card className="flex flex-col items-center p-8 text-center print:shadow-none">
      <p className="font-display text-base font-semibold text-navy-900">{opp.title}</p>
      <p className="mt-1 text-sm text-navy-400">{formatDate(opp.date)}</p>

      <div className="mt-6 rounded-2xl border border-navy-100 p-4">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="Event check-in QR code" width={220} height={220} />
        ) : (
          <div className="flex h-56 w-56 items-center justify-center text-xs text-navy-300">Generating…</div>
        )}
      </div>

      <p className="mt-4 max-w-xs text-xs text-navy-400">
        Volunteers scan this with their phone camera while logged in to Volunteerly to confirm attendance.
      </p>

      {expired ? (
        <p className="mt-2 text-xs font-medium text-red-500">This code has expired.</p>
      ) : (
        <p className="mt-2 text-xs font-medium text-emerald-600">Active until event end</p>
      )}

      <div className="mt-6 flex gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={download} disabled={!dataUrl}>
          <Download className="h-4 w-4" />
          Download
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>
    </Card>
  );
}
