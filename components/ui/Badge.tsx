import type { HTMLAttributes, ReactNode } from "react";

export type BadgeVariant = "neutral" | "accent" | "success" | "warn";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  children: ReactNode;
};

const variantClasses: Record<BadgeVariant, string> = {
  neutral:
    "border-rsi-border bg-rsi-bg-deep/60 text-rsi-text-secondary",
  accent:
    "border-rsi-accent/40 bg-rsi-accent-muted text-rsi-accent",
  success:
    "border-rsi-success/40 bg-rsi-success-muted text-rsi-success",
  warn:
    "border-rsi-warn/40 bg-rsi-warn-muted text-rsi-warn",
};

export function Badge({
  variant = "neutral",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-rsi border px-2 py-0.5 font-mono text-[0.65rem] font-medium uppercase tracking-[0.18em]",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}
