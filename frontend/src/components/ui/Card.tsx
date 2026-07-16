import { type HTMLAttributes, type ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-border bg-background p-5 ${className || ""}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between px-6 pt-5 pb-3 ${className || ""}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ children, className, ...props }: CardHeaderProps) {
  return (
    <div className={`px-6 pb-4 ${className || ""}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className, ...props }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-end gap-2 px-6 pb-5 pt-3 border-t border-border ${className || ""}`} {...props}>
      {children}
    </div>
  );
}