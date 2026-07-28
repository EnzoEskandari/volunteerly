"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/context/auth-context";
import { dashboardPathForRole } from "@/lib/routes";

const links = [
  { href: "/opportunities", label: "Browse Opportunities" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#organizations", label: "For Organizations" },
  { href: "/#faq", label: "FAQ" },
];

export function Navbar() {
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-navy-100/80 bg-white/80 backdrop-blur-md">
      <div className="container-app flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold text-navy-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-white">
            <HeartHandshake className="h-4.5 w-4.5" />
          </span>
          Volunteerly
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-navy-600 transition-colors hover:bg-navy-50 hover:text-navy-900"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {currentUser ? (
            <Link href={dashboardPathForRole(currentUser.role)}>
              <Button size="sm">Go to Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get Started</Button>
              </Link>
            </>
          )}
        </div>

        <button
          className="rounded-lg p-2 text-navy-700 lg:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-navy-100 bg-white px-4 pb-4 pt-2 lg:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-navy-600 hover:bg-navy-50"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2">
            {currentUser ? (
              <Link href={dashboardPathForRole(currentUser.role)}>
                <Button className="w-full">Go to Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    Log in
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="w-full">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
