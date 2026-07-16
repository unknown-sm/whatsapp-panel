import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full rounded-md px-3.5 py-2.5 text-sm bg-background text-ink border border-border transition-all duration-200 hover:border-[var(--border-strong)] focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-tint placeholder:text-[var(--text-4)] ${className || ""}`}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";