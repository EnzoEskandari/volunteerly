import {
  MapPin,
  Sparkles,
  ShieldCheck,
  LineChart,
  Compass,
  Users2,
  CalendarClock,
  BadgeCheck,
  ClipboardList,
  Handshake,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const studentBenefits = [
  { icon: MapPin, title: "Find opportunities nearby", description: "Filter by distance, category, and schedule to see what's actually reachable." },
  { icon: Sparkles, title: "Personalized recommendations", description: "A matching engine that learns your interests, availability, and history." },
  { icon: ShieldCheck, title: "Permanent volunteer record", description: "Every verified hour lives in your profile forever — no lost paper forms." },
  { icon: LineChart, title: "Track progress", description: "Visual goal tracking keeps you moving toward the milestones that matter to you." },
  { icon: Compass, title: "Discover new causes", description: "Explore categories you haven't tried yet, from senior care to environmental science." },
];

const orgBenefits = [
  { icon: Users2, title: "Recruit volunteers", description: "Reach motivated students actively searching for causes like yours." },
  { icon: CalendarClock, title: "Manage events", description: "Create, edit, and track opportunities from one clean dashboard." },
  { icon: BadgeCheck, title: "Verify service hours", description: "Approve completed hours in seconds — students see them instantly." },
  { icon: ClipboardList, title: "Track attendance", description: "QR check-in captures arrival times automatically, no sign-in sheets." },
  { icon: Handshake, title: "Build community", description: "Turn one-time volunteers into a recurring, reliable base of support." },
];

export function Benefits() {
  return (
    <section id="organizations" className="bg-white py-20 lg:py-28">
      <div className="container-app space-y-20">
        {/* Students */}
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">For students</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
              Built around your schedule, your causes, your record.
            </h2>
            <p className="mt-4 max-w-lg text-navy-500">
              Volunteerly replaces scattered spreadsheets and paper verification forms with one trustworthy home for
              your community service.
            </p>
            <Link href="/register" className="mt-6 inline-block">
              <Button>Create a student account</Button>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {studentBenefits.map((b) => (
              <div key={b.title} className="rounded-2xl border border-navy-100 bg-surface p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                  <b.icon className="h-5 w-5 text-brand" />
                </div>
                <p className="mt-3.5 font-display text-sm font-semibold text-navy-900">{b.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-navy-500">{b.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Organizations */}
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="order-2 grid gap-4 sm:grid-cols-2 lg:order-1">
            {orgBenefits.map((b) => (
              <div key={b.title} className="rounded-2xl border border-navy-100 bg-navy-950 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
                  <b.icon className="h-5 w-5 text-emerald-400" />
                </div>
                <p className="mt-3.5 font-display text-sm font-semibold text-white">{b.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-navy-300">{b.description}</p>
              </div>
            ))}
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">For organizations</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
              Recruit, manage, and verify — without the paperwork.
            </h2>
            <p className="mt-4 max-w-lg text-navy-500">
              Every event you post reaches students who are already looking for causes like yours, and every hour you
              verify becomes a permanent, trusted record.
            </p>
            <Link href="/register?type=organization" className="mt-6 inline-block">
              <Button variant="secondary">Register your organization</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
