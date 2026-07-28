"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Is Volunteerly free for students?",
    a: "Yes. Creating a student account, browsing opportunities, joining events, and receiving verified hours are always free.",
  },
  {
    q: "How does hour verification actually work?",
    a: "After your shift, the organization enters your completed hours, an activity description, a supervisor name, and a date directly in Volunteerly. That record appears instantly in your profile with a verification badge — you never edit it yourself, which is exactly what keeps it trustworthy for schools and scholarship applications.",
  },
  {
    q: "Do I need to apply and get accepted to volunteer?",
    a: "No. Volunteerly isn't a job application process. If an event has open capacity and you meet any age or certification requirements, tapping Join Event registers you immediately.",
  },
  {
    q: "What happens if an event is full?",
    a: "You won't be able to join until capacity opens up — for example, if another volunteer cancels. You can save the opportunity and we'll notify you if a spot appears.",
  },
  {
    q: "How does QR check-in work?",
    a: "Each event gets a unique, single-use QR code. Organizations display or print it on-site, and scanning it while logged into Volunteerly confirms your attendance and logs your arrival time. Codes expire after the event and can't be scanned twice.",
  },
  {
    q: "How are nonprofit organizations vetted?",
    a: "Every organization submits registration details for review by our administrators before they can publish opportunities or verify hours, which keeps the platform trustworthy for students and families.",
  },
  {
    q: "Can I download my service hours for a school or scholarship application?",
    a: "Yes — your dashboard includes a full service transcript you can download at any time, listing every verified hour, organization, and supervisor.",
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
