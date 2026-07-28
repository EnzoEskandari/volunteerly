"use client";

import { LayoutDashboard, ShieldAlert, Users, Building2, BarChart3, Flag } from "lucide-react";
import { RequireRole } from "@/components/auth/require-role";
import { DashboardShell, type NavItem } from "@/components/dashboard/shell";
import { useAuth } from "@/lib/context/auth-context";
import type { Admin } from "@/lib/types";

const navItems: NavItem[] = [
  { href: "/dashboard/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/dashboard/admin/users", label: "Users", icon: Users },
  { href: "/dashboard/admin/reports", label: "Reports & Fraud", icon: Flag },
  { href: "/dashboard/admin/analytics", label: "Analytics", icon: BarChart3 },
];

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="admin">
      <AdminShell>{children}</AdminShell>
    </RequireRole>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const admin = currentUser as Admin;

  return (
    <DashboardShell navItems={navItems} notificationAudience="organization" displayName={admin.fullName} subtitle="Administrator">
      {children}
    </DashboardShell>
  );
}
