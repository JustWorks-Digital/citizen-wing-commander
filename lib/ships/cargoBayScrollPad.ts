/**
 * Extra scrollable room around the bay graph so right-click pan / scroll can
 * bring edges into the viewport. Fit-zoom must measure the inner bay node
 * (contentRef), not this pad.
 */

/** Floor so Galaxy (and other large bays) always get usable edge room. */
const SCROLL_EDGE_PAD_MIN_PX = 160;
const SCROLL_EDGE_PAD_MIN_GALAXY_PX = 240;

export function cargoBayScrollEdgePadPx(
  scrollEl: HTMLElement | null,
  shipSlug?: string | null,
): number {
  const min =
    shipSlug === "galaxy"
      ? SCROLL_EDGE_PAD_MIN_GALAXY_PX
      : SCROLL_EDGE_PAD_MIN_PX;
  if (!scrollEl) return min;
  // Half the shorter axis so a bay edge can sit near the viewport center.
  const half = Math.floor(
    Math.min(scrollEl.clientWidth, scrollEl.clientHeight) / 2,
  );
  return Math.max(min, half);
}

/** Scroll so `contentEl` is centered in the scroll viewport. */
export function centerBayInScrollViewport(
  scrollEl: HTMLElement | null,
  contentEl: HTMLElement | null,
): void {
  if (!scrollEl || !contentEl) return;
  const scrollRect = scrollEl.getBoundingClientRect();
  const contentRect = contentEl.getBoundingClientRect();
  if (contentRect.width <= 0 || contentRect.height <= 0) return;
  scrollEl.scrollLeft +=
    contentRect.left +
    contentRect.width / 2 -
    (scrollRect.left + scrollRect.width / 2);
  scrollEl.scrollTop +=
    contentRect.top +
    contentRect.height / 2 -
    (scrollRect.top + scrollRect.height / 2);
}
