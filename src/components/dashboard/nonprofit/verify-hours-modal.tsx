"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useAppData } from "@/lib/context/data-context";
import { useToast } from "@/components/ui/toast";
import type { Student, VolunteerOpportunity, Organization } from "@/lib/types";

export function VerifyHoursModal({
  open,
  onClose,
  student,
  opp,
  org,
}: {
  open: boolean;
  onClose: () => void;
  student: Student;
  opp: VolunteerOpportunity;
  org: Organization;
}) {
  const { verifyHours } = useAppData();
  const { showToast } = useToast();
  const [hours, setHours] = useState(String(opp.hoursAvailable));
  const [description, setDescription] = useState(opp.title);
  const [supervisor, setSupervisor] = useState(org.contactName ?? "");
  const [date, setDate] = useState(opp.date);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await verifyHours({
      studentId: student.id,
      opportunityId: opp.id,
      hours: Number(hours) || 0,
      activityDescription: description,
      supervisor,
      date,
    });

    setSubmitting(false);
    if (!result.ok) {
      setError(result.reason ?? "Couldn't verify those hours.");
      return;
    }
    showToast(`Verified ${hours} hours for ${student.fullName}`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Verify hours — ${student.fullName}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="rounded-xl bg-navy-50 p-3 text-xs text-navy-500">
          Once submitted, this becomes a permanent part of {student.fullName.split(" ")[0]}&apos;s record and
          can&apos;t be edited or removed. Please double-check the hours before verifying.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="hours">Hours completed</Label>
            <Input id="hours" type="number" min={0.5} step={0.5} required value={hours} onChange={(e) => setHours(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="description">Activity description</Label>
          <Textarea id="description" rows={3} required value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="supervisor">Supervisor</Label>
          <Input id="supervisor" required value={supervisor} onChange={(e) => setSupervisor(e.target.value)} placeholder="Full name" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" loading={submitting}>
          Submit verification
        </Button>
      </form>
    </Modal>
  );
}
