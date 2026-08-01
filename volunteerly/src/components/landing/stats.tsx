"use client";

import { useAppData } from "@/lib/context/data-context";
import { formatCompactNumber } from "@/lib/utils";

export function Stats() {
  const { platformStats } = useAppData();

  const items = [
    { label: "Students", value: platformStats.students },
    { label: "Organizations", value: platformStats.organizations },
    { label: "Volunteer Opportunities", value: platformStats.opportunities },
    { label: "Verified Hours", value: platformStats.verifiedHours },
  ];

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
