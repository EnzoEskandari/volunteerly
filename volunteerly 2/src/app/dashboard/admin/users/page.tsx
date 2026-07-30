"use client";

import { useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useAppData } from "@/lib/context/data-context";
import { useToast } from "@/components/ui/toast";

export default function AdminUsersPage() {
  const { students, removeStudent } = useAppData();
  const { showToast } = useToast();
  const [query, setQuery] = useState("");

  const filtered = students.filter((s) => s.fullName.toLowerCase().includes(query.toLowerCase()));

  const handleRemove = (id: string, name: string) => {
    if (!confirm(`Remove ${name}'s account? This can't be undone.`)) return;
    removeStudent(id);
    showToast(`${name} removed`, "info");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Users</h1>
        <p className="mt-1 text-navy-500">Manage student accounts and remove fraudulent activity.</p>
      </div>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
        <Input placeholder="Search students..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" />
      </div>

      <div className="space-y-3">
        {filtered.map((s) => (
          <Card key={s.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Avatar src={s.avatarUrl} name={s.fullName} size={44} />
              <div>
                <p className="text-sm font-semibold text-navy-900">{s.fullName}</p>
                <p className="text-xs text-navy-400">{s.email} · {s.school ?? "No school on file"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="emerald">{s.totalVerifiedHours}h verified</Badge>
              <Button size="sm" variant="danger" onClick={() => handleRemove(s.id, s.fullName)}>
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
