"use client";

import Link from "next/link";
import { Printer, Download, ShieldCheck, FileText, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/progress";
import { useAuth } from "@/lib/context/auth-context";
import { useAppData } from "@/lib/context/data-context";
import { formatDate } from "@/lib/utils";
import type { Student } from "@/lib/types";

export default function TranscriptPage() {
  const { currentUser } = useAuth();
  const { verifiedHours } = useAppData();
  const student = currentUser as Student;

  const records = verifiedHours
    .filter((h) => h.studentId === student.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const total = records.reduce((sum, r) => sum + r.hours, 0);

  const downloadCsv = () => {
    // Certificate number leads: it's the column that makes a row checkable
    // by whoever receives this file.
    const header = ["Certificate Number", "Organization", "Date", "Hours", "Description", "Supervisor"];
    const rows = records.map((r) => [
      r.certificateNumber,
      `"${r.orgName.replace(/"/g, '""')}"`,
      r.date,
      r.hours,
      `"${r.activityDescription.replace(/"/g, '""')}"`,
      `"${r.supervisor.replace(/"/g, '""')}"`,
    ]);
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${student.fullName.replace(/\s+/g, "_")}_Volunteerly_Transcript.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Service Transcript</h1>
          <p className="mt-1 text-navy-500">Every verified hour, permanently on record.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadCsv}>
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardHeader className="border-b border-navy-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{student.fullName}</CardTitle>
              <CardDescription>
                {student.school} {student.gradYear ? `· Class of ${student.gradYear}` : ""}
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-bold text-brand">{total.toFixed(1)}</p>
              <p className="text-xs text-navy-400">total verified hours</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {records.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={FileText}
                title="No verified hours yet"
                description="Completed and verified events will appear here, each with its own certificate."
              />
            </div>
          ) : (
            <ul className="divide-y divide-navy-50">
              {records.map((r) => (
                <li key={r.id} className="px-6 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <p className="font-medium text-navy-900">{r.orgName}</p>
                      <p className="mt-0.5 text-sm text-navy-500">{r.activityDescription}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg font-bold text-navy-900">{r.hours}</p>
                      <p className="text-xs text-navy-400">hours</p>
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-500">
                    <span>{formatDate(r.date)}</span>
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                      Verified by {r.supervisor}
                    </span>
                  </div>

                  {/* The certificate for this entry, sitting directly under it. */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-navy-50 px-3.5 py-2.5 print:bg-white print:ring-1 print:ring-navy-200">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-navy-400">Certificate</p>
                      <p className="mt-0.5 break-all font-mono text-xs font-semibold text-navy-800">
                        {r.certificateNumber}
                      </p>
                    </div>
                    <Link
                      href={`/verify/${r.certificateNumber}`}
                      target="_blank"
                      className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-brand hover:underline print:hidden"
                    >
                      View certificate
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {records.length > 0 && (
        <p className="text-center text-xs leading-relaxed text-navy-400">
          Each certificate can be confirmed by anyone at{" "}
          <span className="font-mono">/verify</span> — no Volunteerly account needed.
        </p>
      )}
    </div>
  );
}
