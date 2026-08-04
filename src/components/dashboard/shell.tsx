"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { HeartHandshake, Menu, X, LogOut, ChevronLeft } from "lucide-react";
import { useAuth } from "@/lib/context/auth-context";
import { Avatar } from "@/components/ui/avatar";
import { NotificationBell } from "./notification-bell";
import { cn } from "@/lib/utils";
import type { NotificationAudience } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

export function DashboardShell({
  navItems,
  notificationAudience,
  displayName,
  subtitle,
  avatarUrl,
  children,
}: {
  navItems: NavItem[];
  notificationAudience: NotificationAudience;
  displayName: string;
  subtitle: string;
  avatarUrl?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { currentUser, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname.startsWith(item.href));

  const sidebarContent = (
    <>
      <Link href="/" className="flex items-center gap-2 px-2 font-display text-base font-bold text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
          <HeartHandshake className="h-4.5 w-4.5" />
        </span>
        Volunteerly
      </Link>

      <nav className="mt-8 flex-1 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-white/10 text-white" : "text-navy-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-navy-300 hover:bg-white/5 hover:text-white"
        >
          <ChevronLeft className="h-4.5 w-4.5" />
          Back to site
        </Link>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-navy-300 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4.5 w-4.5" />
          Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-surface lg:flex">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-navy-950 p-5 lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-navy-950 p-5">{sidebarContent}</aside>
        </div>
      )}

      <div className="flex-1 lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-navy-100 bg-white/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-navy-600 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="font-display text-sm font-semibold text-navy-900 sm:text-base">{displayName}</p>
              <p className="text-xs text-navy-400">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser && <NotificationBell userId={currentUser.id} audience={notificationAudience} />}
            <Avatar src={avatarUrl} name={displayName} size={36} />
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {mobileOpen && (
        <button
          className="fixed right-4 top-4 z-[60] rounded-lg bg-white p-2 text-navy-700 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
