"use client";

import { useAppData } from "@/lib/context/data-context";
import { formatCompactNumber } from "@/lib/utils";

/**
 * Real platform numbers, counted from the database.
 *
 * When Volunteerly is new these are genuinely zero, and a row of zeros
 * says nothing worth saying — so the section removes itself entirely
 * until there is something true to show. It never displays an invented or
 * aspirational figure (spec §5.1).
 */
export function Stats() {
  const { platformStats, loading } = useAppData();

  const items = [
    { label: "Students", value: platformStats.students },
    { label: "Organizations", value: platformStats.organizations },
    { label: "Volunteer Opportunities", value: platformStats.opportunities },
    { label: "Verified Hours", value: platformStats.verifiedHours },
  ];

  // Nothing to report yet, or we don't know yet — render nothing at all
  // rather than a placeholder.
  if (loading || items.every((i) => i.value === 0)) return null;

  return (
    <section id="stats" className="bg-navy-950 py-16">
      <div className="container-app grid grid-cols-2 gap-8 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <p className="font-display text-4xl font-bold text-white sm:text-5xl">
              {formatCompactNumber(item.value)}
            </p>
            <p className="mt-2 text-sm font-medium text-navy-400">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
