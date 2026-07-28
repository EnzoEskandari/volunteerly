import { Search, CalendarCheck, HeartHandshake, BadgeCheck, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: Search,
    title: "Find Opportunities",
    description:
      "Browse and search opportunities filtered by cause, distance, schedule, and virtual or in-person format — or let our matching engine recommend what fits you best.",
  },
  {
    icon: CalendarCheck,
    title: "Join an Event",
    description:
      "Tap Join Event and you're registered instantly — no applications, no waiting for approval. The organization is notified right away.",
  },
  {
    icon: HeartHandshake,
    title: "Volunteer",
    description:
      "Show up and scan the event's QR code to confirm your attendance. Your arrival time is logged automatically.",
  },
  {
    icon: BadgeCheck,
    title: "Receive Verified Hours",
    description:
      "The organization verifies your completed hours directly in Volunteerly. They appear instantly in your permanent, student-owned record.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="container-app py-20 lg:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">The process</p>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
          How Volunteerly Works
        </h2>
        <p className="mt-4 text-navy-500">
          From discovery to a verified record — four steps, zero paperwork.
        </p>
      </div>

      <div className="relative mt-16 grid gap-6 lg:grid-cols-4">
        <div className="absolute left-0 right-0 top-8 hidden h-px bg-navy-200 lg:block" aria-hidden />
        {steps.map((step, i) => (
          <div key={step.title} className="relative flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-card ring-1 ring-navy-100">
              <step.icon className="h-7 w-7 text-brand" />
            </div>
            <p className="mt-5 font-display text-base font-semibold text-navy-900">{step.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-navy-500">{step.description}</p>
            {i < steps.length - 1 && (
              <ArrowRight className="mt-4 h-5 w-5 text-navy-300 lg:hidden" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
