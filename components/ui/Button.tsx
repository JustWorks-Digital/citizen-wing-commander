import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-rsi-accent text-rsi-accent-foreground hover:bg-rsi-accent-hover border border-transparent",
  secondary:
    "bg-rsi-surface-raised text-rsi-text border border-rsi-border hover:border-rsi-border-strong hover:bg-rsi-surface",
  ghost:
    "bg-transparent text-rsi-text-secondary border border-transparent hover:text-rsi-text hover:bg-rsi-surface/60",
  danger:
    "bg-rsi-danger-muted text-rsi-danger border border-rsi-danger/40 hover:bg-rsi-danger hover:text-rsi-text",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-rsi px-4 py-2 text-sm font-semibold tracking-wide uppercase transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
