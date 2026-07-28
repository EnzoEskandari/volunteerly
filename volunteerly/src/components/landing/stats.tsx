import { platformStatsSeed } from "@/lib/mock-data";
import { formatCompactNumber } from "@/lib/utils";

const items = [
  { label: "Students", value: platformStatsSeed.students },
  { label: "Organizations", value: platformStatsSeed.organizations },
  { label: "Volunteer Opportunities", value: platformStatsSeed.opportunities },
  { label: "Verified Hours", value: platformStatsSeed.verifiedHours },
];

export function Stats() {
  return (
    <section id="stats" className="bg-navy-950 py-16">
      <div className="container-app grid grid-cols-2 gap-8 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <p className="font-display text-4xl font-bold text-white sm:text-5xl">
              {formatCompactNumber(item.value)}
              <span className="text-emerald-400">+</span>
            </p>
            <p className="mt-2 text-sm font-medium text-navy-400">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
