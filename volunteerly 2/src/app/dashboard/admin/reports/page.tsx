"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/progress";
import { useAppData } from "@/lib/context/data-context";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";
import { ShieldAlert } from "lucide-react";
import type { ReportStatus } from "@/lib/types";

const statusTone: Record<ReportStatus, "amber" | "emerald" | "red" | "slate"> = {
  open: "red",
  investigating: "amber",
  resolved: "emerald",
  dismissed: "slate",
};

export default function AdminReportsPage() {
  const { reports, updateReportStatus } = useAppData();
  const { showToast } = useToast();

  const sorted = [...reports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleStatusChange = (id: string, status: ReportStatus) => {
    updateReportStatus(id, status);
    showToast(`Report marked as ${status}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Reports &amp; Fraud Alerts</h1>
        <p className="mt-1 text-navy-500">Review user-submitted concerns about students, organizations, and listings.</p>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No reports on file" />
      ) : (
        <div className="space-y-3">
          {sorted.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-navy-900">{r.targetName}</p>
                    <Badge tone="slate">{r.targetType}</Badge>
                  </div>
                  <p className="mt-1 text-sm font-medium text-navy-700">{r.reason}</p>
                  <p className="mt-1 text-sm text-navy-500">{r.details}</p>
                  <p className="mt-2 text-xs text-navy-400">
                    Reported by {r.reporterName} · {timeAgo(r.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone[r.status]}>{r.status}</Badge>
                  <Select
                    value={r.status}
                    onChange={(e) => handleStatusChange(r.id, e.target.value as ReportStatus)}
                    className="h-9 w-40 text-xs"
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </Select>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
