"use client";

import { Printer, Download, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/progress";
import { useAuth } from "@/lib/context/auth-context";
import { useAppData } from "@/lib/context/data-context";
import { formatDate } from "@/lib/utils";
import { FileText } from "lucide-react";
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
    const header = ["Organization", "Date", "Hours", "Description", "Supervisor"];
    const rows = records.map((r) => [r.orgName, r.date, r.hours, `"${r.activityDescription.replace(/"/g, '""')}"`, r.supervisor]);
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
              <EmptyState icon={FileText} title="No verified hours yet" description="Completed and verified events will appear here." />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-navy-400">
                  <th className="px-6 py-3 font-medium">Organization</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Hours</th>
                  <th className="px-6 py-3 font-medium">Supervisor</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-navy-50 last:border-0">
                    <td className="px-6 py-4">
                      <p className="font-medium text-navy-900">{r.orgName}</p>
                      <p className="mt-0.5 text-xs text-navy-400">{r.activityDescription}</p>
                    </td>
                    <td className="px-6 py-4 text-navy-600">{formatDate(r.date)}</td>
                    <td className="px-6 py-4 font-medium text-navy-900">{r.hours}</td>
                    <td className="px-6 py-4 text-navy-600">
                      <div className="flex items-center gap-1.5">
                        {r.supervisor}
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-label="Verified" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
