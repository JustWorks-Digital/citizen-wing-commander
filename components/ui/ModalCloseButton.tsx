import type { ButtonHTMLAttributes } from "react";

export type ModalCloseButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "type"
> & {
  /** Accessible name — defaults to "Close". */
  label?: string;
};

/**
 * Top-right modal dismiss control — X icon only (no text label in the UI).
 * Position the parent `relative` and leave right padding so content clears this button.
 */
export function ModalCloseButton({
  label = "Close",
  className = "",
  ...props
}: ModalCloseButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={[
        "absolute top-2 right-2 z-10 inline-flex size-9 items-center justify-center rounded-rsi text-rsi-text-muted transition-colors",
        "hover:bg-rsi-bg-deep/60 hover:text-rsi-text",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
        "sm:top-3 sm:right-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        aria-hidden
        className="shrink-0"
      >
        <path
          d="M3.2 3.2 12.8 12.8M12.8 3.2 3.2 12.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
