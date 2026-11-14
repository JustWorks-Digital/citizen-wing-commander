import type { HTMLAttributes } from "react";

export type SpinnerProps = HTMLAttributes<SVGSVGElement> & {
  /** Accessible label when the spinner is the sole status cue. */
  label?: string;
};

/** Compact RSI-styled wait indicator for backend / async UI. */
export function Spinner({
  className = "",
  label,
  ...props
}: SpinnerProps) {
  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "status" : undefined}
      viewBox="0 0 24 24"
      className={["animate-spin", className].filter(Boolean).join(" ")}
      fill="none"
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
