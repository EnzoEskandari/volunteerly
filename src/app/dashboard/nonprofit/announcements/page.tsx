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
  const { opportunities, announcements, postAnnouncement } = useAppData();
  const { showToast } = useToast();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [opportunityId, setOpportunityId] = useState("");

  const myOpps = opportunities.filter((o) => o.orgId === org.id);
  const myAnnouncements = announcements
    .filter((a) => a.orgId === org.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;

    setSubmitting(true);
    // The server posts the announcement and notifies the registered
    // volunteers in one step — notifications are server-write-only.
    const result = await postAnnouncement({ title, body, opportunityId: opportunityId || undefined });
    setSubmitting(false);

    if (!result.ok) {
      showToast(result.reason ?? "Couldn't post that announcement.", "error");
      return;
    }

    const notified = (result as { notified?: number }).notified ?? 0;
    showToast(
      notified > 0
        ? `Announcement sent to ${notified} volunteer${notified === 1 ? "" : "s"}`
        : "Announcement posted. No volunteers are registered yet, so nobody was notified.",
    );
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
