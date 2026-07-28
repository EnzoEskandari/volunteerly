import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "brand",
  trend,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "brand" | "emerald" | "navy";
  trend?: string;
}) {
  const toneClasses = {
    brand: "bg-brand-50 text-brand",
    emerald: "bg-emerald-50 text-emerald-600",
    navy: "bg-navy-100 text-navy-700",
  }[tone];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-navy-400">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-navy-900">{value}</p>
          {trend && <p className="mt-1 text-xs font-medium text-emerald-600">{trend}</p>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneClasses)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
