"use client";

import { useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ProgressBar, EmptyState } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Select } from "@/components/ui/input";
import { useAppData } from "@/lib/context/data-context";
import { useToast } from "@/components/ui/toast";
import { genId } from "@/lib/utils";
import type { Goal } from "@/lib/types";

export function GoalsCard({ studentId }: { studentId: string }) {
  const { goals, createGoal, deleteGoal } = useAppData();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);

  const mine = goals.filter((g) => g.studentId === studentId);

  const [type, setType] = useState<Goal["type"]>("hours");
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("50");

  const presets: Record<Goal["type"], string> = {
    hours: "Complete N hours",
    "monthly-cadence": "Volunteer every month",
    "org-count": "Support N organizations",
    custom: "Custom goal",
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const goal: Goal = {
      id: genId("goal"),
      studentId,
      type,
      label: label || presets[type],
      target: Number(target) || 1,
      progress: 0,
      createdAt: new Date().toISOString(),
      completed: false,
    };
    createGoal(goal);
    showToast("Goal created!");
    setOpen(false);
    setLabel("");
    setTarget("50");
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Volunteer Goals</CardTitle>
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New goal
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {mine.length === 0 ? (
          <EmptyState icon={Target} title="No goals yet" description="Set a goal to stay motivated and track your progress." />
        ) : (
          mine.map((g) => (
            <div key={g.id} className="group">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-navy-800">{g.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-navy-400">
                    {g.progress}/{g.target}
                  </span>
                  <button
                    onClick={() => deleteGoal(g.id)}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Delete goal"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-navy-300 hover:text-red-500" />
                  </button>
                </div>
              </div>
              <ProgressBar value={g.progress} max={g.target} tone="emerald" className="mt-2" />
            </div>
          ))
        )}
      </CardContent>

      <Modal open={open} onClose={() => setOpen(false)} title="Create a goal">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label htmlFor="goalType">Goal type</Label>
            <Select id="goalType" value={type} onChange={(e) => setType(e.target.value as Goal["type"])}>
              <option value="hours">Complete N hours</option>
              <option value="monthly-cadence">Volunteer every month</option>
              <option value="org-count">Support N organizations</option>
              <option value="custom">Custom</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="goalLabel">Goal description</Label>
            <Input id="goalLabel" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={presets[type]} />
          </div>
          <div>
            <Label htmlFor="goalTarget">Target</Label>
            <Input id="goalTarget" type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <Button type="submit" className="w-full">
            Create goal
          </Button>
        </form>
      </Modal>
    </Card>
  );
}
