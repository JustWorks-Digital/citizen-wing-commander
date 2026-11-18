const bone = "rounded-rsi bg-rsi-surface-raised/80 animate-pulse";

function StopThumbBone() {
  return <div className={`size-9 shrink-0 rounded-full sm:size-10 ${bone}`} />;
}

function StopCardBone() {
  return (
    <div className="flex flex-col gap-3 border-b border-rsi-divider/80 px-3 py-4">
      <div className="flex items-start gap-3">
        <div className={`mt-1 size-5 shrink-0 rounded-sm ${bone}`} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className={`h-4 w-40 max-w-full ${bone}`} />
          <div className="flex flex-wrap gap-1.5">
            <div className={`h-5 w-14 ${bone}`} />
            <div className={`h-5 w-16 ${bone}`} />
          </div>
        </div>
        <div className={`hidden h-8 w-16 shrink-0 sm:block ${bone}`} />
      </div>
      <div className="ml-8 space-y-2">
        <div className={`h-16 w-full max-w-md ${bone}`} />
        <div className={`h-3 w-28 ${bone}`} />
      </div>
    </div>
  );
}

export type ChecklistStopsSkeletonProps = {
  /** Placeholder stop cards in the checklist column. */
  cards?: number;
  /** Placeholder thumbs in the desktop Stops rail. */
  railStops?: number;
  className?: string;
};

/** Stops rail + checklist placeholders while the trip hydrates. */
export function ChecklistStopsSkeleton({
  cards = 3,
  railStops = 5,
  className,
}: ChecklistStopsSkeletonProps) {
  return (
    <div
      className={["flex min-w-0 max-w-full items-start gap-4", className]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading stops…</span>

      {/* Desktop Stops rail */}
      <aside
        aria-hidden
        className="sticky top-1.5 hidden w-[8.75rem] shrink-0 flex-col overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface/90 shadow-[0_12px_40px_rgba(0,0,0,0.35)] lg:flex"
      >
        <div className="flex shrink-0 flex-col items-center gap-1 border-b border-rsi-divider/60 bg-rsi-bg-deep/40 px-2 py-2">
          <div className={`h-2 w-10 ${bone}`} />
          <div className={`h-3 w-8 ${bone}`} />
        </div>
        <div className="flex flex-col items-center gap-3 px-2 py-3">
          {Array.from({ length: railStops }, (_, index) => (
            <div key={index} className="flex w-full flex-col items-center gap-1.5">
              <StopThumbBone />
              <div className={`h-2.5 w-12 ${bone}`} />
              {index < railStops - 1 ? (
                <div className={`my-0.5 h-3 w-0.5 ${bone}`} />
              ) : null}
            </div>
          ))}
        </div>
      </aside>

      <div
        aria-hidden
        className="min-w-0 max-w-full flex-1 overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface/90 shadow-rsi-panel"
      >
        {/* Mobile Stops band */}
        <div className="border-b border-rsi-divider/60 bg-rsi-bg-deep/40 px-3 py-3 lg:hidden">
          <div className={`mb-3 h-3 w-28 ${bone}`} />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: Math.min(railStops, 4) }, (_, index) => (
              <div key={index} className="flex w-[5.75rem] shrink-0 flex-col items-center gap-1.5">
                <div className={`h-2 w-4 ${bone}`} />
                <StopThumbBone />
                <div className={`h-2.5 w-14 ${bone}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="border-b border-rsi-divider/60 bg-rsi-bg-deep/40 px-3 py-2">
          <div className={`h-3 w-16 ${bone}`} />
        </div>
        {Array.from({ length: cards }, (_, index) => (
          <StopCardBone key={index} />
        ))}
      </div>
    </div>
  );
}
