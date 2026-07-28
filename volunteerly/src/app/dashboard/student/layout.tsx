"use client";

import { LayoutDashboard, Search, UserCircle, FileText } from "lucide-react";
import { RequireRole } from "@/components/auth/require-role";
import { DashboardShell, type NavItem } from "@/components/dashboard/shell";
import { useAuth } from "@/lib/context/auth-context";
import type { Student } from "@/lib/types";

const navItems: NavItem[] = [
  { href: "/dashboard/student", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/opportunities", label: "Browse Opportunities", icon: Search },
  { href: "/dashboard/student/profile", label: "My Profile", icon: UserCircle },
  { href: "/dashboard/student/transcript", label: "Service Transcript", icon: FileText },
];

export default function StudentDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="student">
      <StudentShell>{children}</StudentShell>
    </RequireRole>
  );
}

function StudentShell({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const student = currentUser as Student;

  return (
    <DashboardShell
      navItems={navItems}
      notificationAudience="student"
      displayName={student.fullName}
      subtitle={student.school ?? "Student"}
      avatarUrl={student.avatarUrl}
    >
      {children}
    </DashboardShell>
  );
}
