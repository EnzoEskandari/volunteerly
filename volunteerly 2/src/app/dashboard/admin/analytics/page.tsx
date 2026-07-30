"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { useAppData } from "@/lib/context/data-context";
import { platformStatsSeed } from "@/lib/mock-data";
import { formatCompactNumber } from "@/lib/utils";
import { GraduationCap, Building2, CalendarCheck, Clock } from "lucide-react";
import { CAUSE_CATEGORIES } from "@/lib/types";

const COLORS = ["#2563EB", "#10B981", "#0F172A", "#8FB1FA", "#6EE7B7", "#425477", "#34D399", "#1D4FD6", "#96A4BF", "#059669", "#193689", "#C3CCDC", "#047857"];

export default function AdminAnalyticsPage() {
  const { opportunities, organizations } = useAppData();

  const byCategory = CAUSE_CATEGORIES.map((c) => ({
    name: c,
    value: opportunities.filter((o) => o.category === c).length,
  })).filter((d) => d.value > 0);

  const orgsByCategory = new Map<string, number>();
  organizations.forEach((o) => o.category.forEach((c) => orgsByCategory.set(c, (orgsByCategory.get(c) ?? 0) + 1)));
  const orgCategoryData = Array.from(orgsByCategory.entries()).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Platform Analytics</h1>
        <p className="mt-1 text-navy-500">Aggregate statistics across the entire Volunteerly platform.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Students" value={formatCompactNumber(platformStatsSeed.students)} icon={GraduationCap} tone="brand" />
        <StatCard label="Organizations" value={formatCompactNumber(platformStatsSeed.organizations)} icon={Building2} tone="emerald" />
        <StatCard label="Opportunities" value={formatCompactNumber(platformStatsSeed.opportunities)} icon={CalendarCheck} tone="navy" />
        <StatCard label="Verified Hours" value={formatCompactNumber(platformStatsSeed.verifiedHours)} icon={Clock} tone="brand" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Opportunities by Category</CardTitle>
            <CardDescription>Live listings across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E7EF" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64769D" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64769D" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E7EF", fontSize: 13 }} />
                  <Bar dataKey="value" fill="#2563EB" radius={[0, 6, 6, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organizations by Cause</CardTitle>
            <CardDescription>What causes are best represented on the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={orgCategoryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {orgCategoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E7EF", fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
