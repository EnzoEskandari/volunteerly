"use client";

import Link from "next/link";
import { ArrowRight, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { students } from "@/lib/mock-data";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(600px circle at 15% 20%, rgba(37,99,235,0.35), transparent 60%), radial-gradient(500px circle at 85% 15%, rgba(16,185,129,0.25), transparent 55%)",
        }}
      />
      <div className="container-app relative grid gap-12 pb-20 pt-16 lg:grid-cols-2 lg:items-center lg:pb-28 lg:pt-24">
        <div>
          <div className="mb-6 inline-flex animate-fade-up items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-navy-200">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Digitally verified by real nonprofits
          </div>
          <h1
            className="animate-fade-up font-display text-4xl font-bold tracking-tight text-white text-balance sm:text-5xl lg:text-6xl"
            style={{ animationDelay: "60ms" }}
          >
            Volunteer Better.
          </h1>
          <p
            className="mt-5 max-w-xl animate-fade-up text-lg leading-relaxed text-navy-300 text-balance"
            style={{ animationDelay: "140ms" }}
          >
            Find meaningful volunteer opportunities, build your impact, and receive trusted digital records of your
            community service.
          </p>
          <div
            className="mt-8 flex animate-fade-up flex-wrap gap-3"
            style={{ animationDelay: "220ms" }}
          >
            <Link href="/register">
              <Button size="lg" className="group">
                Get Started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link href="/opportunities">
              <Button size="lg" variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                <Search className="h-4 w-4" />
                Browse Opportunities
              </Button>
            </Link>
            <Link href="/register?type=organization">
              <Button size="lg" variant="ghost" className="text-navy-200 hover:bg-white/5 hover:text-white">
                Register Your Organization
              </Button>
            </Link>
          </div>

          <div
            className="mt-10 flex animate-fade-up items-center gap-3"
            style={{ animationDelay: "300ms" }}
          >
            <div className="flex -space-x-2.5">
              {students.map((s) => (
                <Avatar key={s.id} src={s.avatarUrl} name={s.fullName} size={36} className="ring-2 ring-navy-950" />
              ))}
            </div>
            <p className="text-sm text-navy-300">
              Joined by <span className="font-semibold text-white">128,000+</span> students nationwide
            </p>
          </div>
        </div>

        <div className="relative animate-fade-up" style={{ animationDelay: "180ms" }}>
          <HeroPreviewCard />
        </div>
      </div>
    </section>
  );
}

function HeroPreviewCard() {
  return (
    <div className="relative mx-auto max-w-md rounded-2xl border border-white/10 bg-white p-5 shadow-card-hover lg:mx-0 lg:ml-auto">
      <div className="flex items-center justify-between border-b border-navy-100 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-navy-400">Service Transcript</p>
          <p className="font-display text-lg font-semibold text-navy-900">Maya Chen</p>
        </div>
        <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Verified</div>
      </div>
      <div className="mt-4 space-y-3">
        {[
          { org: "Coastal Paws Animal Rescue", hours: "1.5 hrs", date: "Jul 16" },
          { org: "Green Shoreline Initiative", hours: "2.5 hrs", date: "Jun 1" },
          { org: "Foothill Food Bank", hours: "3 hrs", date: "May 18" },
        ].map((row) => (
          <div key={row.org} className="flex items-center justify-between rounded-xl bg-navy-50/70 px-3.5 py-3">
            <div>
              <p className="text-sm font-medium text-navy-900">{row.org}</p>
              <p className="text-xs text-navy-400">{row.date}</p>
            </div>
            <span className="text-sm font-semibold text-brand">{row.hours}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-navy-900 px-4 py-3.5 text-white">
        <span className="text-sm font-medium">Total verified hours</span>
        <span className="font-display text-xl font-bold">38.0</span>
      </div>
    </div>
  );
}
