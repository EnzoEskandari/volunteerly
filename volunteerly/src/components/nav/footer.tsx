import Link from "next/link";
import { HeartHandshake } from "lucide-react";

const columns = [
  {
    title: "Platform",
    links: [
      { href: "/opportunities", label: "Browse Opportunities" },
      { href: "/register", label: "Register Your Organization" },
      { href: "/#how-it-works", label: "How It Works" },
    ],
  },
  {
    title: "Students",
    links: [
      { href: "/register", label: "Create an Account" },
      { href: "/#pricing", label: "Membership Pricing" },
      { href: "/dashboard/student/transcript", label: "Service Transcript" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Organizations",
    links: [
      { href: "/register?type=organization", label: "Register Your Nonprofit" },
      { href: "/#organizations", label: "Organization Benefits" },
      { href: "/dashboard/nonprofit", label: "Nonprofit Dashboard" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-navy-100 bg-navy-950 text-navy-200">
      <div className="container-app grid grid-cols-2 gap-10 py-16 sm:grid-cols-3 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 font-display text-lg font-bold text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
              <HeartHandshake className="h-4.5 w-4.5 text-white" />
            </span>
            Volunteerly
          </div>
          <p className="mt-3 max-w-xs text-sm text-navy-400">
            Trusted, verified community service — for every student and every nonprofit.
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-semibold text-white">{col.title}</p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-navy-400 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-navy-800">
        <div className="container-app flex flex-col items-center justify-between gap-2 py-5 text-xs text-navy-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Volunteerly, Inc. All rights reserved.</p>
          <p>Made for students and the nonprofits they support.</p>
        </div>
      </div>
    </footer>
  );
}
