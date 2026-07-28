"use client";

import Link from "next/link";
import {
  Clock,
  CalendarCheck,
  Building2,
  Flame,
  ArrowRight,
  MapPin,
  FileText,
  Bell,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/progress";
import { StatCard } from "@/components/dashboard/stat-card";
import { GoalsCard } from "@/components/dashboard/student/goals-card";
import { ProgressChart } from "@/components/dashboard/student/progress-chart";
import { AchievementsCard } from "@/components/dashboard/student/achievements-card";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { useAuth } from "@/lib/context/auth-context";
import { useAppData } from "@/lib/context/data-context";
import { recommendedOpportunities } from "@/lib/matching";
import { formatShortDate, formatTimeRange, timeAgo } from "@/lib/utils";
import type { Student } from "@/lib/types";

export default function StudentDashboardPage() {
  const { currentUser } = useAuth();
  const student = currentUser as Student;
  const {
    opportunities,
    registrations,
    verifiedHours,
    goals,
    notifications,
    achievementsCatalog,
    studentAchievements,
  } = useAppData();

  const myRegistrations = registrations.filter((r) => r.studentId === student.id && r.status !== "cancelled");
  const upcoming = myRegistrations
    .map((r) => ({ reg: r, opp: opportunities.find((o) => o.id === r.opportunityId) }))
    .filter((x) => x.opp && new Date(x.opp.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.opp!.date).getTime() - new Date(b.opp!.date).getTime());

  const myVerifiedHours = verifiedHours
    .filter((h) => h.studentId === student.id)
    .sort((a, b) => new Date(b.verifiedAt).getTime() - new Date(a.verifiedAt).getTime());

  const orgsVolunteeredWith = Array.from(new Set(myVerifiedHours.map((h) => h.orgId)));

  const myNotifications = notifications
    .filter((n) => n.userId === student.id && n.audience === "student")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const myGoals = goals.filter((g) => g.studentId === student.id);
  const myAchievements = studentAchievements.filter((a) => a.studentId === student.id);

  const recommended = recommendedOpportunities(student, opportunities, myVerifiedHours, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Welcome back, {student.fullName.split(" ")[0]}</h1>
        <p className="mt-1 text-navy-500">Here's what's happening with your volunteer journey.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Verified Hours" value={student.totalVerifiedHours} icon={Clock} tone="brand" />
        <StatCard label="Upcoming Events" value={upcoming.length} icon={CalendarCheck} tone="emerald" />
        <StatCard label="Organizations" value={orgsVolunteeredWith.length} icon={Building2} tone="navy" />
        <StatCard label="Volunteer Streak" value={`${student.volunteerStreakWeeks} wks`} icon={Flame} tone="brand" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Upcoming Events</CardTitle>
                <CardDescription>Events you've joined that haven't happened yet</CardDescription>
              </div>
              <Link href="/opportunities">
                <Button size="sm" variant="ghost">
                  Browse more
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={CalendarCheck}
                  title="No upcoming events"
                  description="Join an opportunity to see it here."
                  action={
                    <Link href="/opportunities">
                      <Button size="sm">Browse Opportunities</Button>
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {upcoming.map(({ opp }) => (
                    <Link
                      key={opp!.id}
                      href={`/opportunities/${opp!.id}`}
                      className="flex items-center justify-between rounded-xl border border-navy-100 p-4 transition-colors hover:bg-navy-50"
                    >
                      <div>
                        <p className="font-medium text-navy-900">{opp!.title}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-navy-400">
                          <MapPin className="h-3.5 w-3.5" />
                          {opp!.orgName}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium text-navy-900">{formatShortDate(opp!.date)}</p>
                        <p className="text-xs text-navy-400">{formatTimeRange(opp!.startTime, opp!.endTime)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <ProgressChart hours={myVerifiedHours} />

          {recommended.length > 0 && (
            <div>
              <p className="mb-3 font-display text-base font-semibold text-navy-900">Recommended for You</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {recommended.map((o) => (
                  <OpportunityCard key={o.id} opp={o} matchScore={80} />
                ))}
              </div>
            </div>
          )}

          <AchievementsCard catalog={achievementsCatalog} earned={myAchievements} />
        </div>

        <div className="space-y-6">
          <GoalsCard studentId={student.id} />

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              <FileText className="h-4 w-4 text-navy-300" />
            </CardHeader>
            <CardContent className="space-y-3">
              {myVerifiedHours.slice(0, 4).map((h) => (
                <div key={h.id} className="flex items-start justify-between gap-3 border-b border-navy-50 pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-navy-800">{h.orgName}</p>
                    <p className="text-xs text-navy-400">{h.activityDescription}</p>
                  </div>
                  <Badge tone="emerald" className="shrink-0">
                    +{h.hours}h
                  </Badge>
                </div>
              ))}
              <Link href="/dashboard/student/transcript" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                View full transcript
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Notifications</CardTitle>
              <Bell className="h-4 w-4 text-navy-300" />
            </CardHeader>
            <CardContent className="space-y-3">
              {myNotifications.slice(0, 4).map((n) => (
                <div key={n.id} className="border-b border-navy-50 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-navy-800">{n.title}</p>
                  <p className="mt-0.5 text-xs text-navy-400">{timeAgo(n.createdAt)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
