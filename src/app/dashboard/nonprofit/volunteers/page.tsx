"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/progress";
import { useAuth } from "@/lib/context/auth-context";
import { useAppData } from "@/lib/context/data-context";
import type { Organization, Student } from "@/lib/types";
import { Users } from "lucide-react";

export default function VolunteersPage() {
  return (
    <Suspense fallback={null}>
      <VolunteersContent />
    </Suspense>
  );
}

function VolunteersContent() {
  const params = useSearchParams();
  const { currentUser } = useAuth();
  const org = currentUser as Organization;
  const { opportunities, registrations, verifiedHours, students } = useAppData();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Student | null>(
    students.find((s) => s.id === params.get("student")) ?? null,
  );

  const myOppIds = new Set(opportunities.filter((o) => o.orgId === org.id).map((o) => o.id));

  const volunteerIds = Array.from(
    new Set(registrations.filter((r) => myOppIds.has(r.opportunityId) && r.status !== "cancelled").map((r) => r.studentId)),
  );

  const volunteers = volunteerIds
    .map((id) => students.find((s) => s.id === id))
    .filter((s): s is Student => !!s)
    .filter((s) => s.fullName.toLowerCase().includes(query.toLowerCase()));

  const hoursWithOrg = (studentId: string) =>
    verifiedHours.filter((h) => h.studentId === studentId && h.orgId === org.id).reduce((s, h) => s + h.hours, 0);

  const eventCount = (studentId: string) =>
    registrations.filter((r) => r.studentId === studentId && myOppIds.has(r.opportunityId) && r.status !== "cancelled").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Volunteers</h1>
        <p className="mt-1 text-navy-500">Everyone who has registered for one of your events.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
        <Input placeholder="Search volunteers..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
      </div>

      {volunteers.length === 0 ? (
        <EmptyState icon={Users} title="No volunteers yet" description="Once students join your events, they'll show up here." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {volunteers.map((s) => (
            <Card key={s.id} className="cursor-pointer p-4 transition-shadow hover:shadow-card-hover" onClick={() => setSelected(s)}>
              <div className="flex items-center gap-3">
                <Avatar src={s.avatarUrl} name={s.fullName} size={44} />
                <div>
                  <p className="text-sm font-semibold text-navy-900">{s.fullName}</p>
                  <p className="text-xs text-navy-400">{s.school ?? s.email}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Badge tone="brand">{eventCount(s.id)} events</Badge>
                <Badge tone="emerald">{hoursWithOrg(s.id)}h verified</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Volunteer profile">
        {selected && (
          <div>
            <div className="flex items-center gap-3">
              <Avatar src={selected.avatarUrl} name={selected.fullName} size={56} />
              <div>
                <p className="font-display text-lg font-semibold text-navy-900">{selected.fullName}</p>
                <p className="text-sm text-navy-400">{selected.email}</p>
              </div>
            </div>
            {selected.bio && <p className="mt-4 text-sm text-navy-600">{selected.bio}</p>}
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium text-navy-400">School</p>
                <p className="text-navy-800">{selected.school ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-navy-400">Age</p>
                <p className="text-navy-800">{selected.age ?? "—"}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium text-navy-400">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.skills.length ? selected.skills.map((sk) => <Badge key={sk} tone="slate">{sk}</Badge>) : <span className="text-sm text-navy-400">—</span>}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-navy-50 px-4 py-3">
              <span className="text-sm font-medium text-navy-700">Hours verified with your org</span>
              <span className="font-display text-lg font-bold text-brand">{hoursWithOrg(selected.id)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
