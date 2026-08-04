"use client";

import { useState } from "react";
import { Search, Check, X, Ban, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useAppData } from "@/lib/context/data-context";
import { useToast } from "@/components/ui/toast";
import type { OrgApprovalStatus } from "@/lib/types";

const statusTone: Record<OrgApprovalStatus, "amber" | "emerald" | "red" | "slate"> = {
  pending: "amber",
  approved: "emerald",
  rejected: "red",
  suspended: "slate",
};

export default function AdminOrganizationsPage() {
  const { organizations, setOrgApproval } = useAppData();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrgApprovalStatus | "All">("All");

  const filtered = organizations.filter((o) => {
    if (statusFilter !== "All" && o.approvalStatus !== statusFilter) return false;
    if (query && !o.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const setStatus = (id: string, name: string, status: OrgApprovalStatus) => {
    let reason: string | undefined;
    if (status === "rejected" || status === "suspended") {
      reason = prompt(`Reason for ${status === "rejected" ? "rejecting" : "suspending"} ${name}?`) ?? undefined;
    }
    setOrgApproval(id, status, reason);
    showToast(`${name} marked as ${status}`, status === "approved" ? "success" : "info");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Organizations</h1>
        <p className="mt-1 text-navy-500">Approve, reject, or suspend nonprofit organizations.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
          <Input placeholder="Search organizations..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-1.5">
          {(["All", "pending", "approved", "rejected", "suspended"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === s ? "bg-navy-900 text-white" : "bg-white text-navy-600 hover:bg-navy-50"
              } border border-navy-100`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((o) => (
          <Card key={o.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar src={o.logoUrl} name={o.name} size={44} />
              <div>
                <p className="text-sm font-semibold text-navy-900">{o.name}</p>
                <p className="text-xs text-navy-400">{o.contactName} · {o.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone[o.approvalStatus]}>{o.approvalStatus}</Badge>
              {o.approvalStatus === "pending" && (
                <>
                  <Button size="sm" variant="success" onClick={() => setStatus(o.id, o.name, "approved")}>
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(o.id, o.name, "rejected")}>
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                </>
              )}
              {o.approvalStatus === "approved" && (
                <Button size="sm" variant="outline" onClick={() => setStatus(o.id, o.name, "suspended")}>
                  <Ban className="h-3.5 w-3.5" /> Suspend
                </Button>
              )}
              {(o.approvalStatus === "suspended" || o.approvalStatus === "rejected") && (
                <Button size="sm" variant="outline" onClick={() => setStatus(o.id, o.name, "approved")}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reinstate
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
