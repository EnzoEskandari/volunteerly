import React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-navy-200 bg-white px-3.5 text-sm text-ink placeholder:text-navy-300",
        "transition-shadow focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand-100",
        "disabled:cursor-not-allowed disabled:bg-navy-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-navy-200 bg-white px-3.5 py-3 text-sm text-ink placeholder:text-navy-300",
        "transition-shadow focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand-100",
        "disabled:cursor-not-allowed disabled:bg-navy-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-navy-200 bg-white px-3.5 text-sm text-ink",
        "transition-shadow focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand-100",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-navy-700", className)} {...props} />;
}
