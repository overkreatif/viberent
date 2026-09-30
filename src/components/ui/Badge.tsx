import type { HTMLAttributes } from "react";

type BadgeVariant = "gold" | "neutral" | "outline" | "success" | "warning" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variants: Record<BadgeVariant, string> = {
  gold: "bg-accent/15 text-primary border border-accent/30",
  neutral: "bg-muted text-muted-foreground",
  outline: "border border-border text-muted-foreground",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border border-amber-200",
  danger: "bg-red-50 text-destructive border border-red-200",
};

export function Badge({ variant = "neutral", className = "", ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}
