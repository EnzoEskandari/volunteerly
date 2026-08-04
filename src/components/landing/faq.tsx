"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { membershipPriceLabel } from "@/lib/pricing";

const faqs = [
  {
    q: "Is Volunteerly free for students?",
    a: `Creating an account and browsing opportunities is always free. Joining events, checking in with a QR code, and receiving verified hours require a Volunteerly membership — ${membershipPriceLabel()}. Fee waivers are available for students who qualify for free or reduced-price lunch or a similar need-based program, so cost is never the reason you can't record your service.`,
  },
  {
    q: "Why don't organizations pay anything?",
    a: "Most volunteer platforms charge the nonprofit, or require a school district to buy a license before a single student can sign up. Volunteerly doesn't. Any organization can post unlimited opportunities, generate QR codes, and verify hours for free, permanently — and any student can join today without waiting for their school to purchase anything.",
  },
  {
    q: "How does hour verification actually work?",
    a: "After your shift, the organization enters your completed hours, an activity description, a supervisor's name, and the date. That record appears in your profile with a verification badge and is locked permanently — neither you nor anyone else can edit it afterwards. That's what makes it hold up for schools and scholarship applications.",
  },
  {
    q: "Do I need to apply and get accepted to volunteer?",
    a: "No. Volunteerly isn't a job application process. If an event has open capacity and you meet any age or certification requirements, tapping Join registers you immediately.",
  },
  {
    q: "What happens if an event is full?",
    a: "You won't be able to join until capacity opens up — for example, if another volunteer cancels. If a requirement isn't met, Volunteerly tells you exactly which one rather than just refusing.",
  },
  {
    q: "How does QR check-in work?",
    a: "Each event gets its own check-in code, which the organization displays or prints on-site. Scanning it while logged in confirms your attendance and records your arrival time. The code stops working when the event ends, and you can't check in to the same event twice.",
  },
  {
    q: "How are nonprofit organizations vetted?",
    a: "Every organization submits its registration details — including a tax ID — for review by our administrators before it can publish opportunities or verify hours.",
  },
  {
    q: "Can I download my service hours for a school or scholarship application?",
    a: "Yes. Your dashboard includes a full service transcript you can download at any time, listing every verified hour along with the organization and supervisor who signed off on it.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-white py-20 lg:py-28">
      <div className="container-app">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
            Questions, answered
          </h2>
        </div>

        <div className="mx-auto mt-12 max-w-3xl divide-y divide-navy-100 rounded-2xl border border-navy-100">
          {faqs.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-sm font-semibold text-navy-900 sm:text-base">{item.q}</span>
                  <ChevronDown
                    className={cn("h-5 w-5 shrink-0 text-navy-400 transition-transform", isOpen && "rotate-180")}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-5 text-sm leading-relaxed text-navy-500">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
