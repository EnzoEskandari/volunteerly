import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  max,
  tone = "brand",
  className,
}: {
  value: number;
  max: number;
  tone?: "brand" | "emerald" | "navy";
  className?: string;
}) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  const toneClass = {
    brand: "bg-brand",
    emerald: "bg-emerald",
    navy: "bg-navy",
  }[tone];

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-navy-100", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-700 ease-out", toneClass)}
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy-200 px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-navy-50">
          <Icon className="h-6 w-6 text-navy-400" />
        </div>
      )}
      <p className="font-display text-base font-semibold text-navy-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-navy-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
