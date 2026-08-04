"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { VerifiedHours } from "@/lib/types";

export function ProgressChart({ hours }: { hours: VerifiedHours[] }) {
  const byMonth = new Map<string, number>();
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString("en-US", { month: "short" });
    byMonth.set(key, 0);
  }

  hours.forEach((h) => {
    const d = new Date(h.date);
    const key = d.toLocaleDateString("en-US", { month: "short" });
    if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + h.hours);
  });

  const data = Array.from(byMonth.entries()).map(([month, value]) => ({ month, hours: value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hours Over Time</CardTitle>
        <CardDescription>Verified hours logged over the last six months</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E7EF" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64769D" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64769D" }} />
              <Tooltip
                cursor={{ fill: "#F4F6F9" }}
                contentStyle={{ borderRadius: 12, border: "1px solid #E2E7EF", fontSize: 13 }}
                formatter={(value: number) => [`${value} hrs`, "Verified"]}
              />
              <Bar dataKey="hours" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
