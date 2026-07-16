import { type LabelHTMLAttributes, type ReactNode } from "react";

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
}

export function Label({ children, className, ...props }: LabelProps) {
  return (
    <label
      className={`block text-sm mb-1 text-ink-2 ${className || ""}`}
      {...props}
    >
      {children}
    </label>
  );
}