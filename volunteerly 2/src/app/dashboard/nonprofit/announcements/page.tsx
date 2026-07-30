"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/progress";
import { useAuth } from "@/lib/context/auth-context";
import { useAppData } from "@/lib/context/data-context";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";
import type { Organization } from "@/lib/types";

export default function AnnouncementsPage() {
  const { currentUser } = useAuth();
  const org = currentUser as Organization;
  const { opportunities, registrations, announcements, postAnnouncement, pushNotification } = useAppData();
  const { showToast } = useToast();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [opportunityId, setOpportunityId] = useState("");

  const myOpps = opportunities.filter((o) => o.orgId === org.id);
  const myAnnouncements = announcements
    .filter((a) => a.orgId === org.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;

    postAnnouncement({ orgId: org.id, orgName: org.name, title, body, opportunityId: opportunityId || undefined });

    const recipients = opportunityId
      ? registrations.filter((r) => r.opportunityId === opportunityId && r.status !== "cancelled").map((r) => r.studentId)
      : Array.from(
          new Set(
            registrations
              .filter((r) => myOpps.some((o) => o.id === r.opportunityId) && r.status !== "cancelled")
              .map((r) => r.studentId),
          ),
        );

    recipients.forEach((studentId) => {
      pushNotification({
        userId: studentId,
        audience: "student",
        type: "announcement",
        title: `${org.name} posted an announcement`,
        body: title,
      });
    });

    showToast(`Announcement sent to ${recipients.length} volunteer${recipients.length === 1 ? "" : "s"}`);
    setTitle("");
    setBody("");
    setOpportunityId("");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Announcements</h1>
        <p className="mt-1 text-navy-500">Send updates directly to your registered volunteers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New announcement</CardTitle>
          <CardDescription>Target a specific event, or all of your volunteers.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="target">Audience</Label>
              <Select id="target" value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)}>
                <option value="">All volunteers</option>
                {myOpps.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bring closed-toe shoes" />
            </div>
            <div>
              <Label htmlFor="body">Message</Label>
              <Textarea id="body" rows={4} required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details for your volunteers..." />
            </div>
            <Button type="submit" className="w-full">
              Send announcement
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <p className="mb-3 font-display text-base font-semibold text-navy-900">Sent announcements</p>
        {myAnnouncements.length === 0 ? (
          <EmptyState icon={Megaphone} title="No announcements yet" />
        ) : (
          <div className="space-y-3">
            {myAnnouncements.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-navy-900">{a.title}</p>
                  <span className="text-xs text-navy-400">{timeAgo(a.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-sm text-navy-600">{a.body}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
