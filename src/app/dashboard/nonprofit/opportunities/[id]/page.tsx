"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/progress";
import { QRCodeDisplay } from "@/components/qr/qr-code-display";
import { VerifyHoursModal } from "@/components/dashboard/nonprofit/verify-hours-modal";
import { useAuth } from "@/lib/context/auth-context";
import { useAppData } from "@/lib/context/data-context";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatTimeRange } from "@/lib/utils";
import type { Organization, Student } from "@/lib/types";

export default function ManageOpportunityPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuth();
  const org = currentUser as Organization;
  const { opportunities, registrations, attendanceRecords, verifiedHours, students, qrTokens, deleteOpportunity } =
    useAppData();
  const { showToast } = useToast();

  const [verifyTarget, setVerifyTarget] = useState<Student | null>(null);

  const opp = opportunities.find((o) => o.id === params.id && o.orgId === org.id);
  const qrToken = qrTokens.find((q) => q.opportunityId === params.id);

  if (!opp) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-lg font-semibold text-navy-900">Opportunity not found</p>
        <Link href="/dashboard/nonprofit" className="mt-3 inline-block text-sm text-brand hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const roster = registrations
    .filter((r) => r.opportunityId === opp.id && r.status !== "cancelled")
    .map((r) => ({
      registration: r,
      student: students.find((s) => s.id === r.studentId)!,
      attendance: attendanceRecords.find((a) => a.registrationId === r.id),
      verified: verifiedHours.find((h) => h.studentId === r.studentId && h.opportunityId === opp.id),
    }))
    .filter((r) => r.student);

  const handleDelete = () => {
    if (!confirm("Delete this opportunity? This can't be undone.")) return;
    deleteOpportunity(opp.id);
    showToast("Opportunity deleted", "info");
    router.push("/dashboard/nonprofit");
  };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/nonprofit" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-900">
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="brand">{opp.category}</Badge>
            <Badge tone={opp.status === "full" ? "red" : "emerald"}>{opp.status}</Badge>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold text-navy-900">{opp.title}</h1>
          <p className="mt-1 text-navy-500">
            {formatDate(opp.date)} · {formatTimeRange(opp.startTime, opp.endTime)} · {opp.location}
          </p>
        </div>
        <Button variant="danger" size="sm" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Volunteer Roster</CardTitle>
              <CardDescription>
                {roster.length} registered · {roster.filter((r) => r.attendance).length} checked in · {roster.filter((r) => r.verified).length} verified
              </CardDescription>
            </CardHeader>
            <CardContent>
              {roster.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="No volunteers yet" description="Once students join, they'll appear here." />
              ) : (
                <div className="space-y-2">
                  {roster.map(({ student, attendance, verified }) => (
                    <div key={student.id} className="flex items-center justify-between rounded-xl border border-navy-100 p-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar src={student.avatarUrl} name={student.fullName} size={36} />
                        <div>
                          <Link href={`/dashboard/nonprofit/volunteers?student=${student.id}`} className="text-sm font-medium text-navy-900 hover:text-brand">
                            {student.fullName}
                          </Link>
                          <p className="text-xs text-navy-400">{student.school ?? student.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {verified ? (
                          <Badge tone="emerald">
                            <ShieldCheck className="h-3 w-3" /> Verified {verified.hours}h
                          </Badge>
                        ) : attendance ? (
                          <Button size="sm" variant="outline" onClick={() => setVerifyTarget(student)}>
                            Verify hours
                          </Button>
                        ) : (
                          <Badge tone="slate">
                            <Clock className="h-3 w-3" /> Not checked in
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-navy-600">{opp.description}</p>
            </CardContent>
          </Card>
        </div>

        <div>{qrToken && <QRCodeDisplay opp={opp} qrToken={qrToken} />}</div>
      </div>

      {verifyTarget && (
        <VerifyHoursModal open={!!verifyTarget} onClose={() => setVerifyTarget(null)} student={verifyTarget} opp={opp} org={org} />
      )}
    </div>
  );
}
