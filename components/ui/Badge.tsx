import type { HTMLAttributes, ReactNode } from "react";

export type BadgeVariant = "neutral" | "accent" | "success" | "warn";
export type BadgeSize = "xs" | "sm" | "md";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
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

const sizeClasses: Record<BadgeSize, string> = {
  xs: "px-1 py-0 text-[0.45rem] leading-tight tracking-[0.1em]",
  sm: "px-1 py-px text-[0.5rem] tracking-[0.12em]",
  md: "px-2 py-0.5 text-[0.65rem] tracking-[0.18em]",
};

export function Badge({
  variant = "neutral",
  size = "md",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-rsi border font-mono font-medium uppercase",
        sizeClasses[size],
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
