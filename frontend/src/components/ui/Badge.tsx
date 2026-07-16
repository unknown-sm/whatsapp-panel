import { type HTMLAttributes, type ReactNode } from "react";

type BadgeVariant = "default" | "brand" | "success" | "warning" | "danger";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

const variants: Record<BadgeVariant, string> = {
  default: "bg-atlas-muted text-ink-2",
  brand: "bg-brand-soft text-brand-text",
  success: "bg-[var(--success-muted)] text-success",
  warning: "bg-[var(--warning-muted)] text-warning",
  danger: "bg-[var(--danger-muted)] text-danger",
};

export function Badge({ variant = "default", children, className, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-medium ${variants[variant]} ${className || ""}`}
      {...props}
    >
      {children}
    </span>
  );
}