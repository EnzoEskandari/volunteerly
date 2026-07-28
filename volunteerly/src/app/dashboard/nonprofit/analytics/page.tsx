"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { useAuth } from "@/lib/context/auth-context";
import { useAppData } from "@/lib/context/data-context";
import { Users, Clock, CalendarCheck, Repeat } from "lucide-react";
import type { Organization } from "@/lib/types";

const COLORS = ["#2563EB", "#10B981", "#0F172A", "#8FB1FA", "#6EE7B7"];

export default function AnalyticsPage() {
  const { currentUser } = useAuth();
  const org = currentUser as Organization;
  const { opportunities, registrations, verifiedHours } = useAppData();

  const myOpps = opportunities.filter((o) => o.orgId === org.id);
  const myOppIds = new Set(myOpps.map((o) => o.id));
  const myRegs = registrations.filter((r) => myOppIds.has(r.opportunityId) && r.status !== "cancelled");
  const myHours = verifiedHours.filter((h) => h.orgId === org.id);

  const uniqueVolunteers = new Set(myRegs.map((r) => r.studentId));
  const repeatVolunteers = Array.from(uniqueVolunteers).filter(
    (id) => myRegs.filter((r) => r.studentId === id).length > 1,
  ).length;

  const byMonth = new Map<string, number>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    byMonth.set(d.toLocaleDateString("en-US", { month: "short" }), 0);
  }
  myHours.forEach((h) => {
    const key = new Date(h.date).toLocaleDateString("en-US", { month: "short" });
    if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + h.hours);
  });
  const hoursData = Array.from(byMonth.entries()).map(([month, hours]) => ({ month, hours }));

  const byEventData = myOpps
    .map((o) => ({ name: o.title.length > 18 ? o.title.slice(0, 18) + "…" : o.title, volunteers: o.currentVolunteers }))
    .sort((a, b) => b.volunteers - a.volunteers)
    .slice(0, 6);

  const categoryTotals = new Map<string, number>();
  myOpps.forEach((o) => categoryTotals.set(o.category, (categoryTotals.get(o.category) ?? 0) + o.currentVolunteers));
  const categoryData = Array.from(categoryTotals.entries()).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Organization Analytics</h1>
        <p className="mt-1 text-navy-500">How your events and volunteer base are trending.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Events Posted" value={myOpps.length} icon={CalendarCheck} tone="brand" />
        <StatCard label="Unique Volunteers" value={uniqueVolunteers.size} icon={Users} tone="emerald" />
        <StatCard label="Repeat Volunteers" value={repeatVolunteers} icon={Repeat} tone="navy" />
        <StatCard label="Hours Verified" value={myHours.reduce((s, h) => s + h.hours, 0).toFixed(1)} icon={Clock} tone="brand" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Verified Hours by Month</CardTitle>
            <CardDescription>Total hours your organization has verified</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hoursData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E7EF" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64769D" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64769D" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E7EF", fontSize: 13 }} />
                  <Bar dataKey="hours" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Volunteers by Event</CardTitle>
            <CardDescription>Your most-joined opportunities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byEventData} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E7EF" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64769D" }} />
                  <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64769D" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E7EF", fontSize: 13 }} />
                  <Bar dataKey="volunteers" fill="#2563EB" radius={[0, 6, 6, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {categoryData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Volunteers by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E7EF", fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
