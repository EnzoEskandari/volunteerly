"use client";

import Link from "next/link";
import { Building2, Users, ShieldAlert, GraduationCap, ArrowRight, Check, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/progress";
import { StatCard } from "@/components/dashboard/stat-card";
import { useAppData } from "@/lib/context/data-context";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";
import { platformStatsSeed } from "@/lib/mock-data";
import { formatCompactNumber } from "@/lib/utils";

export default function AdminOverviewPage() {
  const { organizations, students, reports, setOrgApproval } = useAppData();
  const { showToast } = useToast();

  const pending = organizations.filter((o) => o.approvalStatus === "pending");
  const openReports = reports.filter((r) => r.status === "open" || r.status === "investigating");

  const approve = (id: string, name: string) => {
    setOrgApproval(id, "approved");
    showToast(`${name} approved`);
  };
  const reject = (id: string, name: string) => {
    const reason = prompt(`Reason for rejecting ${name}?`) ?? undefined;
    setOrgApproval(id, "rejected", reason);
    showToast(`${name} rejected`, "info");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Platform Overview</h1>
        <p className="mt-1 text-navy-500">Moderate organizations, review reports, and monitor platform health.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Students" value={formatCompactNumber(platformStatsSeed.students)} icon={GraduationCap} tone="brand" />
        <StatCard label="Organizations" value={formatCompactNumber(platformStatsSeed.organizations)} icon={Building2} tone="emerald" />
        <StatCard label="Pending Reviews" value={pending.length} icon={Users} tone="navy" />
        <StatCard label="Open Reports" value={openReports.length} icon={ShieldAlert} tone="brand" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Pending Organizations</CardTitle>
              <CardDescription>New registrations awaiting approval</CardDescription>
            </div>
            <Link href="/dashboard/admin/organizations">
              <Button size="sm" variant="ghost">
                View all
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {pending.length === 0 ? (
              <EmptyState icon={Building2} title="Nothing pending" description="New organization registrations will appear here." />
            ) : (
              <div className="space-y-3">
                {pending.map((o) => (
                  <div key={o.id} className="rounded-xl border border-navy-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{o.name}</p>
                        <p className="mt-0.5 text-xs text-navy-400">{o.contactName} · {o.email}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {o.category.map((c) => (
                            <Badge key={c} tone="slate">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="success" onClick={() => approve(o.id, o.name)}>
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reject(o.id, o.name)}>
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Reports</CardTitle>
              <CardDescription>User-submitted concerns and fraud alerts</CardDescription>
            </div>
            <Link href="/dashboard/admin/reports">
              <Button size="sm" variant="ghost">
                View all
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {openReports.length === 0 ? (
              <EmptyState icon={ShieldAlert} title="No open reports" />
            ) : (
              <div className="space-y-3">
                {openReports.slice(0, 4).map((r) => (
                  <div key={r.id} className="rounded-xl border border-navy-100 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-navy-900">{r.targetName}</p>
                      <Badge tone={r.status === "investigating" ? "amber" : "red"}>{r.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-navy-500">{r.reason}</p>
                    <p className="mt-1 text-xs text-navy-400">Reported by {r.reporterName} · {timeAgo(r.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
