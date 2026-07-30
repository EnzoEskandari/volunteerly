import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-600 shadow-sm hover:shadow-card focus-visible:ring-brand-300",
  secondary:
    "bg-navy text-white hover:bg-navy-700 shadow-sm hover:shadow-card focus-visible:ring-navy-300",
  outline:
    "border border-navy-200 bg-white text-navy-900 hover:bg-navy-50 focus-visible:ring-navy-200",
  ghost: "text-navy-700 hover:bg-navy-100 focus-visible:ring-navy-200",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-300",
  success: "bg-emerald text-white hover:bg-emerald-600 focus-visible:ring-emerald-300",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-5 text-sm gap-2 rounded-xl",
  lg: "h-13 px-7 text-base gap-2 rounded-xl",
  icon: "h-10 w-10 rounded-xl",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-150 ease-out",
          "focus-visible:outline-none focus-visible:ring-4 disabled:opacity-50 disabled:pointer-events-none",
          "active:scale-[0.98]",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
