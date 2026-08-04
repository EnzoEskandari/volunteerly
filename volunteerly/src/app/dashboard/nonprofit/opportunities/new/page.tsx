"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useAuth } from "@/lib/context/auth-context";
import { useAppData } from "@/lib/context/data-context";
import { useToast } from "@/components/ui/toast";
import { CAUSE_CATEGORIES, type CauseCategory, type Organization } from "@/lib/types";

export default function NewOpportunityPage() {
  const { currentUser } = useAuth();
  const { createOpportunity } = useAppData();
  const { showToast } = useToast();
  const router = useRouter();
  const org = currentUser as Organization;

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: CAUSE_CATEGORIES[0] as CauseCategory,
    date: "",
    startTime: "09:00",
    endTime: "12:00",
    location: "",
    isVirtual: false,
    hoursAvailable: "3",
    maxVolunteers: "15",
    minAge: "",
    requiresBackgroundCheck: false,
  });

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.date) {
      showToast("Please fill in a title and date.", "error");
      return;
    }

    setSubmitting(true);
    // The server creates the listing and its check-in code together, and
    // generates the QR token with crypto-grade randomness.
    const result = await createOpportunity({
      title: form.title,
      description: form.description,
      category: form.category,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.isVirtual ? "Virtual" : form.location,
      isVirtual: form.isVirtual,
      hoursAvailable: Number(form.hoursAvailable) || 1,
      maxVolunteers: Number(form.maxVolunteers) || 1,
      minAge: form.minAge ? Number(form.minAge) : undefined,
      certifications: [],
      backgroundCheck: form.requiresBackgroundCheck,
    });
    setSubmitting(false);

    if (!result.ok || !result.id) {
      showToast(result.reason ?? "Couldn't publish that opportunity.", "error");
      return;
    }
    showToast("Opportunity published!");
    router.push(`/dashboard/nonprofit/opportunities/${result.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-navy-900">Create Opportunity</h1>
      <p className="mt-1 text-navy-500">Publish a new volunteer event for students to discover and join.</p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Event details</CardTitle>
          <CardDescription>Students see this information before deciding to join.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Saturday Shelter Dog Walking" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={4} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What will volunteers be doing?" />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as CauseCategory })}>
                {CAUSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="startTime">Start time</Label>
                <Input id="startTime" type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="endTime">End time</Label>
                <Input id="endTime" type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isVirtual"
                type="checkbox"
                checked={form.isVirtual}
                onChange={(e) => setForm({ ...form, isVirtual: e.target.checked })}
                className="h-4 w-4 rounded border-navy-300 text-brand focus:ring-brand-200"
              />
              <Label htmlFor="isVirtual" className="mb-0">
                This is a virtual opportunity
              </Label>
            </div>

            {!form.isVirtual && (
              <div>
                <Label htmlFor="location">Location</Label>
                <Input id="location" required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="214 Ortega St, Santa Barbara, CA" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hours">Hours available</Label>
                <Input id="hours" type="number" min={0.5} step={0.5} value={form.hoursAvailable} onChange={(e) => setForm({ ...form, hoursAvailable: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="maxVolunteers">Max volunteers</Label>
                <Input id="maxVolunteers" type="number" min={1} value={form.maxVolunteers} onChange={(e) => setForm({ ...form, maxVolunteers: e.target.value })} />
              </div>
            </div>

            <div className="rounded-xl border border-navy-100 p-4">
              <p className="mb-3 text-sm font-medium text-navy-700">Requirements (optional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minAge">Minimum age</Label>
                  <Input id="minAge" type="number" value={form.minAge} onChange={(e) => setForm({ ...form, minAge: e.target.value })} placeholder="None" />
                </div>
                <div className="flex items-end gap-2 pb-2.5">
                  <input
                    id="backgroundCheck"
                    type="checkbox"
                    checked={form.requiresBackgroundCheck}
                    onChange={(e) => setForm({ ...form, requiresBackgroundCheck: e.target.checked })}
                    className="h-4 w-4 rounded border-navy-300 text-brand focus:ring-brand-200"
                  />
                  <Label htmlFor="backgroundCheck" className="mb-0">
                    Requires background check
                  </Label>
                </div>
              </div>
            </div>

            <Button type="submit" loading={submitting} className="w-full" size="lg">
              Publish Opportunity
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
