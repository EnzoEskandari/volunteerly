import React from "react";
import { cn } from "@/lib/utils";

type Tone = "navy" | "brand" | "emerald" | "amber" | "red" | "slate";

const toneStyles: Record<Tone, string> = {
  navy: "bg-navy-100 text-navy-700",
  brand: "bg-brand-50 text-brand-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  slate: "bg-slate-100 text-slate-600",
};

export function Badge({
  tone = "navy",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium leading-none",
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  );
}
