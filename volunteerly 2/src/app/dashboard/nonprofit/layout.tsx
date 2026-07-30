"use client";

import { LayoutDashboard, CalendarPlus, Users, Megaphone, BarChart3 } from "lucide-react";
import { RequireRole } from "@/components/auth/require-role";
import { DashboardShell, type NavItem } from "@/components/dashboard/shell";
import { useAuth } from "@/lib/context/auth-context";
import type { Organization } from "@/lib/types";

const navItems: NavItem[] = [
  { href: "/dashboard/nonprofit", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/nonprofit/opportunities/new", label: "Create Opportunity", icon: CalendarPlus },
  { href: "/dashboard/nonprofit/volunteers", label: "Volunteers", icon: Users },
  { href: "/dashboard/nonprofit/announcements", label: "Announcements", icon: Megaphone },
  { href: "/dashboard/nonprofit/analytics", label: "Analytics", icon: BarChart3 },
];

export default function NonprofitDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole role="organization">
      <NonprofitShell>{children}</NonprofitShell>
    </RequireRole>
  );
}

function NonprofitShell({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const org = currentUser as Organization;

  if (org.approvalStatus !== "approved") {
    return <PendingApprovalScreen org={org} />;
  }

  return (
    <DashboardShell
      navItems={navItems}
      notificationAudience="organization"
      displayName={org.name}
      subtitle="Organization"
      avatarUrl={org.logoUrl}
    >
      {children}
    </DashboardShell>
  );
}

function PendingApprovalScreen({ org }: { org: Organization }) {
  const { logout } = useAuth();
  const isRejected = org.approvalStatus === "rejected";
  const isSuspended = org.approvalStatus === "suspended";

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="w-full max-w-md rounded-2xl border border-navy-100 bg-white p-8 text-center shadow-card">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            isRejected || isSuspended ? "bg-red-50" : "bg-amber-50"
          }`}
        >
          <span className={`font-display text-xl font-bold ${isRejected || isSuspended ? "text-red-500" : "text-amber-500"}`}>
            {isRejected || isSuspended ? "!" : "…"}
          </span>
        </div>
        <h1 className="mt-4 font-display text-xl font-bold text-navy-900">
          {isSuspended ? "Account suspended" : isRejected ? "Registration not approved" : "Registration under review"}
        </h1>
        <p className="mt-2 text-sm text-navy-500">
          {isSuspended &&
            "Your organization's account has been suspended by a Volunteerly administrator. Contact support for details."}
          {isRejected && (org.rejectionReason || "An administrator reviewed your registration and it wasn't approved at this time.")}
          {org.approvalStatus === "pending" &&
            "Thanks for registering " + org.name + "! An administrator is reviewing your submission — this usually takes 1–2 business days. We'll notify you as soon as you're approved."}
        </p>
        <button onClick={logout} className="mt-6 text-sm font-medium text-brand hover:underline">
          Log out
        </button>
      </div>
    </div>
  );
}
