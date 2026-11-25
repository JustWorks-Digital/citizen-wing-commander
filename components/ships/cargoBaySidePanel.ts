/**
 * Shared Packing / Legend panel chrome for overlay vs docked (push) layout.
 */

/** Border + fill only — no `shadow-rsi-panel` (its 1px ring doubles the border). */
const PANEL_SHELL =
  "pointer-events-auto w-[16rem] space-y-1.5 rounded-rsi border border-rsi-border bg-rsi-bg-deep/95 px-2 py-1.5";

export type CargoBaySidePanelOpts = {
  /** Absolute over the graph vs docked sibling that shrinks it. */
  overlay: boolean;
  side: "left" | "right";
  /** Clear a parent Legend / Packing toggle along the top edge. */
  toggleAbove?: boolean;
  /** Override absolute top inset (e.g. stacked Packing + Peel toggles). */
  topClassName?: string;
  /** Override absolute start inset (`left-*` / `right-*`). */
  insetClassName?: string;
  /**
   * When true, height is set by the caller (e.g. match graph `heightPx`) —
   * skip the default max-height clamp, and skip the panel shadow ring so the
   * outline matches the graph border (shadow-rsi-panel adds an extra 1px).
   */
  matchGraphHeight?: boolean;
  /** Overflow scroll hint classes from `useOverflowScrollY`. */
  scrollClassName?: string;
};

/** Class string for Packing / Legend side panels. */
export function cargoBaySidePanelClassName({
  overlay,
  side,
  toggleAbove = false,
  topClassName,
  insetClassName,
  matchGraphHeight = false,
  scrollClassName = "",
}: CargoBaySidePanelOpts): string {
  // Floating panels keep the soft drop; graph-matched packing skips the ring
  // so height/border match the cargo grid chrome.
  const elevation = matchGraphHeight ? "" : "shadow-rsi-panel";
  if (overlay) {
    const top =
      topClassName ?? (toggleAbove ? "top-8" : "top-2");
    const inset =
      insetClassName ?? (side === "left" ? "left-2" : "right-2");
    // Packing (left) above Legend (right) if they ever overlap.
    const z = side === "left" ? "z-40" : "z-20";
    return [
      PANEL_SHELL,
      elevation,
      "absolute overflow-y-auto overscroll-contain",
      matchGraphHeight ? "box-border" : "max-h-[calc(100%-3.5rem)]",
      z,
      inset,
      top,
      scrollClassName,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return [
    PANEL_SHELL,
    elevation,
    "relative z-10 shrink-0 self-stretch overflow-y-auto overscroll-contain",
    matchGraphHeight ? "box-border" : "max-h-full",
    toggleAbove ? "mt-8" : "mt-2",
    "mb-2",
    scrollClassName,
  ]
    .filter(Boolean)
    .join(" ");
}
