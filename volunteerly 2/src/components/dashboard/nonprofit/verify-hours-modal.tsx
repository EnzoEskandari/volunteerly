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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyHours({
      studentId: student.id,
      opportunityId: opp.id,
      orgId: org.id,
      hours: Number(hours) || 0,
      activityDescription: description,
      supervisor,
      date,
    });
    showToast(`Verified ${hours} hours for ${student.fullName}`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Verify hours — ${student.fullName}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
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
        <Button type="submit" className="w-full">
          Submit verification
        </Button>
      </form>
    </Modal>
  );
}
