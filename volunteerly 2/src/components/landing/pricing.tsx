import Link from "next/link";
import { Check, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MEMBERSHIP_PRICE_USD } from "@/lib/types";

const studentIncluded = [
  "Personalized opportunity recommendations",
  "Join unlimited volunteer opportunities",
  "QR check-in & digitally verified hours",
  "Downloadable service transcript",
  "Goal tracking & achievements",
];

const orgIncluded = [
  "Unlimited opportunity listings",
  "Automatic QR code generation",
  "One-screen hour verification",
  "Attendance tracking & announcements",
  "No subscription, ever",
];

export function Pricing() {
  return (
    <section id="pricing" className="bg-surface py-20 lg:py-28">
      <div className="container-app">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Pricing</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
            Free for nonprofits. Almost free for students.
          </h2>
          <p className="mt-4 text-navy-500">
            Organizations are the causes that make Volunteerly worth using — so they never pay a cent. A small annual
            student membership keeps the whole network running.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-3xl gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-brand bg-white p-7 shadow-card-hover">
            <p className="text-sm font-semibold uppercase tracking-wide text-brand">Students</p>
            <p className="mt-3 font-display text-4xl font-bold text-navy-900">
              ${MEMBERSHIP_PRICE_USD}
              <span className="text-base font-medium text-navy-400">/year</span>
            </p>
            <p className="mt-1 text-sm text-navy-400">Less than 42¢/month</p>
            <ul className="mt-6 space-y-2.5">
              {studentIncluded.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-navy-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/register" className="mt-7 block">
              <Button className="w-full" size="lg">
                Create a student account
              </Button>
            </Link>
            <p className="mt-3 text-center text-xs text-navy-400">
              Browsing is always free. Fee waivers available for students who qualify.
            </p>
          </div>

          <div className="rounded-2xl border border-navy-100 bg-navy-950 p-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">Nonprofit Organizations</p>
            <p className="mt-3 font-display text-4xl font-bold text-white">
              Free
              <span className="text-base font-medium text-navy-400"> forever</span>
            </p>
            <p className="mt-1 text-sm text-navy-400">No subscription, no per-seat pricing</p>
            <ul className="mt-6 space-y-2.5">
              {orgIncluded.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-navy-200">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/register?type=organization" className="mt-7 block">
              <Button variant="outline" className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10" size="lg">
                Register your organization
              </Button>
            </Link>
            <div className="mt-4 flex items-start gap-2 text-xs text-navy-400">
              <HeartHandshake className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              No setup fees, no per-seat charges, no catch — just tools built to help you recruit and manage
              volunteers.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
