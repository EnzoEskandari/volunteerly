"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CalendarCheck, Users, ClipboardCheck, TrendingUp, ArrowRight, QrCode } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/progress";
import { StatCard } from "@/components/dashboard/stat-card";
import { useAuth } from "@/lib/context/auth-context";
import { useAppData } from "@/lib/context/data-context";
import { useToast } from "@/components/ui/toast";
import { formatShortDate, formatTimeRange } from "@/lib/utils";
import type { Organization } from "@/lib/types";

export default function NonprofitDashboardPage() {
  return (
    <Suspense fallback={null}>
      <NonprofitDashboardContent />
    </Suspense>
  );
}

function NonprofitDashboardContent() {
  const params = useSearchParams();
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const org = currentUser as Organization;
  const { opportunities, registrations, attendanceRecords, verifiedHours, announcements } = useAppData();

  useEffect(() => {
    if (params.get("justRegistered")) {
      showToast("Registration submitted! We'll notify you once an admin reviews it.", "info");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myOpps = opportunities.filter((o) => o.orgId === org.id);
  const upcoming = myOpps
    .filter((o) => o.status !== "completed" && o.status !== "cancelled")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const myOppIds = new Set(myOpps.map((o) => o.id));
  const totalVolunteers = new Set(
    registrations.filter((r) => myOppIds.has(r.opportunityId) && r.status !== "cancelled").map((r) => r.studentId),
  ).size;
  const totalAttendance = attendanceRecords.filter((a) => myOppIds.has(a.opportunityId)).length;
  const totalVerified = verifiedHours.filter((h) => h.orgId === org.id).reduce((s, h) => s + h.hours, 0);

  const pendingVerification = attendanceRecords
    .filter((a) => myOppIds.has(a.opportunityId))
    .filter((a) => !verifiedHours.some((h) => h.studentId === a.studentId && h.opportunityId === a.opportunityId));

  const myAnnouncements = announcements.filter((a) => a.orgId === org.id).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">{org.name}</h1>
          <p className="mt-1 text-navy-500">Here's your organization's activity at a glance.</p>
        </div>
        <Link href="/dashboard/nonprofit/opportunities/new">
          <Button>Create Opportunity</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Upcoming Events" value={upcoming.length} icon={CalendarCheck} tone="brand" />
        <StatCard label="Total Volunteers" value={totalVolunteers} icon={Users} tone="emerald" />
        <StatCard label="Attendance Logged" value={totalAttendance} icon={ClipboardCheck} tone="navy" />
        <StatCard label="Hours Verified" value={totalVerified.toFixed(1)} icon={TrendingUp} tone="brand" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Upcoming Events</CardTitle>
                <CardDescription>Manage volunteers, generate QR codes, and edit details</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={CalendarCheck}
                  title="No upcoming events"
                  description="Create your first opportunity to start recruiting volunteers."
                  action={
                    <Link href="/dashboard/nonprofit/opportunities/new">
                      <Button size="sm">Create Opportunity</Button>
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {upcoming.map((o) => (
                    <Link
                      key={o.id}
                      href={`/dashboard/nonprofit/opportunities/${o.id}`}
                      className="flex items-center justify-between rounded-xl border border-navy-100 p-4 transition-colors hover:bg-navy-50"
                    >
                      <div>
                        <p className="font-medium text-navy-900">{o.title}</p>
                        <p className="mt-1 text-xs text-navy-400">
                          {formatShortDate(o.date)} · {formatTimeRange(o.startTime, o.endTime)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge tone={o.status === "full" ? "red" : "brand"}>
                          {o.currentVolunteers}/{o.maxVolunteers}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-navy-300" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Volunteer History</CardTitle>
              <CardDescription>Everyone who has completed a verified event with you</CardDescription>
            </CardHeader>
            <CardContent>
              {verifiedHours.filter((h) => h.orgId === org.id).length === 0 ? (
                <p className="text-sm text-navy-400">No verified hours logged yet.</p>
              ) : (
                <div className="space-y-3">
                  {verifiedHours
                    .filter((h) => h.orgId === org.id)
                    .slice(0, 6)
                    .map((h) => (
                      <div key={h.id} className="flex items-center justify-between border-b border-navy-50 pb-3 last:border-0 last:pb-0">
                        <div>
                          <p className="text-sm font-medium text-navy-800">{h.activityDescription}</p>
                          <p className="text-xs text-navy-400">Supervised by {h.supervisor}</p>
                        </div>
                        <Badge tone="emerald">{h.hours}h</Badge>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Verify Hours</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-navy-300" />
            </CardHeader>
            <CardContent>
              {pendingVerification.length === 0 ? (
                <p className="text-sm text-navy-400">Nothing awaiting verification.</p>
              ) : (
                <div className="space-y-2">
                  {pendingVerification.slice(0, 5).map((a) => {
                    const opp = opportunities.find((o) => o.id === a.opportunityId);
                    return (
                      <Link
                        key={a.id}
                        href={`/dashboard/nonprofit/opportunities/${a.opportunityId}`}
                        className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2.5 text-sm"
                      >
                        <span className="font-medium text-amber-800">{opp?.title}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-amber-600" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>QR Code Generator</CardTitle>
              <QrCode className="h-4 w-4 text-navy-300" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-navy-500">
                Every event automatically gets a unique check-in code. Open any event to display or print it.
              </p>
              {upcoming[0] && (
                <Link href={`/dashboard/nonprofit/opportunities/${upcoming[0].id}`} className="mt-3 inline-block">
                  <Button size="sm" variant="outline">
                    View next event's QR code
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Announcements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {myAnnouncements.length === 0 ? (
                <p className="text-sm text-navy-400">No announcements posted yet.</p>
              ) : (
                myAnnouncements.map((a) => (
                  <div key={a.id} className="border-b border-navy-50 pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-navy-800">{a.title}</p>
                    <p className="mt-0.5 text-xs text-navy-400">{a.body}</p>
                  </div>
                ))
              )}
              <Link href="/dashboard/nonprofit/announcements" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                Manage announcements
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
