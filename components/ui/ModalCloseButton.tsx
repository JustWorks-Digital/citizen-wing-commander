import type { ButtonHTMLAttributes } from "react";

export type ModalCloseButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "type"
> & {
  /** Accessible name — defaults to "Close". */
  label?: string;
  /**
   * `corner` (default) — box above the panel, right edges flush.
   * `inline` — flex/toolbar sibling (no absolute offset).
   */
  placement?: "corner" | "inline";
};

/**
 * Modal dismiss control — X icon only (no text label in the UI).
 * Default is a rounded box sitting above the top edge of a `relative` panel,
 * right-aligned flush with the panel. Do not reserve `pr-12` / `pr-14`.
 */
export function ModalCloseButton({
  label = "Close",
  placement = "corner",
  className = "",
  ...props
}: ModalCloseButtonProps) {
  const position =
    placement === "inline"
      ? "relative inline-flex shrink-0"
      : "absolute right-0 bottom-full mb-2";

  return (
    <button
      type="button"
      aria-label={label}
      className={[
        position,
        "z-20 inline-flex size-9 items-center justify-center rounded-rsi",
        "border border-rsi-border bg-rsi-surface text-rsi-text-muted shadow-rsi-panel transition-colors",
        "hover:border-rsi-border-strong hover:bg-rsi-surface-raised hover:text-rsi-text",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
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
