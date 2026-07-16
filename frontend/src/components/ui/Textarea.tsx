import { forwardRef, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`w-full rounded-md px-3.5 py-2.5 text-sm bg-background text-ink border border-border transition-all duration-200 hover:border-[var(--border-strong)] focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-tint placeholder:text-[var(--text-4)] resize-none ${className || ""}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";