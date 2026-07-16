import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "default" | "ghost" | "outline" | "destructive";
type Size = "sm" | "default" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  default: "bg-brand text-white hover:bg-brand-hover active:scale-[0.98]",
  ghost: "text-ink-2 hover:bg-atlas-hover hover:text-ink",
  outline: "border border-border bg-background text-ink hover:bg-atlas-hover",
  destructive: "bg-danger text-white hover:opacity-90 active:scale-[0.98]",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[13px]",
  default: "px-4 py-2 text-sm",
  icon: "w-9 h-9",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className || ""}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";