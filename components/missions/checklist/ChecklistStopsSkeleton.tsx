const bone = "rounded-rsi bg-rsi-surface-raised/80 animate-pulse";

function StopThumbBone() {
  return <div className={`size-9 shrink-0 rounded-full sm:size-10 ${bone}`} />;
}

function MissionCardBone() {
  return (
    <div className="overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface/90 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className={`h-2.5 w-16 ${bone}`} />
          <div className={`h-3 w-[70%] max-w-[10rem] ${bone}`} />
        </div>
        <div className={`size-4 shrink-0 rounded-full ${bone}`} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <div className={`h-5 w-14 ${bone}`} />
        <div className={`h-5 w-12 ${bone}`} />
      </div>
    </div>
  );
}

function PadGraphBone() {
  return (
    <div className="flex min-h-[12rem] flex-col overflow-hidden rounded-rsi border border-rsi-border bg-rsi-bg-deep/30">
      <div className="flex items-center gap-2 border-b border-rsi-border px-2.5 py-1.5">
        <div className={`size-4 shrink-0 rounded-full ${bone}`} />
        <div className={`h-2.5 w-16 ${bone}`} />
        <div className={`ml-auto h-5 w-10 ${bone}`} />
      </div>
      <div className="flex flex-1 items-center justify-center p-3">
        <div className={`h-28 w-full max-w-[14rem] ${bone}`} />
      </div>
    </div>
  );
}

function StopCardBone() {
  return (
    <div className="flex flex-col border-b border-rsi-divider/80 px-3 pt-4.5 pb-1">
      <div className="flex min-w-0 flex-1 flex-col">
          {/* Location + next hop (Done sits before ship on the right) */}
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
            <div className="min-w-0 space-y-2 lg:flex-1">
              <div className="flex items-center gap-2">
                <div className={`size-10 shrink-0 rounded-full ${bone}`} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className={`h-4 w-40 max-w-full ${bone}`} />
                  <div className="flex flex-wrap gap-1.5">
                    <div className={`h-5 w-14 ${bone}`} />
                    <div className={`h-5 w-16 ${bone}`} />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2 lg:flex-1 lg:pt-0.5">
              <div className={`h-12 w-20 shrink-0 ${bone}`} />
              <div className={`size-8 shrink-0 rounded-full ${bone}`} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className={`h-2.5 w-16 ${bone}`} />
                <div className={`h-4 w-full max-w-[10rem] ${bone}`} />
              </div>
            </div>
          </div>

          {/* Drop off / Pick up tabs + transfer/cards | pad graph */}
          <div className="mt-5 overflow-x-clip pb-5">
            <div className="flex flex-col gap-3 text-sm lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-4 lg:gap-y-2">
              <div className="flex gap-1 lg:col-start-1 lg:row-start-1">
                <div
                  className={`h-7 w-[4.75rem] rounded-[calc(var(--radius-rsi)-2px)] ${bone}`}
                />
                <div
                  className={`h-7 w-[4.75rem] rounded-[calc(var(--radius-rsi)-2px)] ${bone}`}
                />
              </div>
              <div className="min-w-0 space-y-2 lg:col-start-1 lg:row-start-2">
                <div className={`h-14 w-full ${bone}`} />
                <div className="grid grid-cols-1 gap-2 min-[450px]:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <MissionCardBone />
                  <MissionCardBone />
                </div>
              </div>
              <div className="min-w-0 lg:col-start-2 lg:row-start-2">
                <PadGraphBone />
              </div>
            </div>
          </div>

          {/* Payout / EXP */}
          <div className="mt-2 flex w-full min-w-0 flex-col lg:flex-row lg:gap-4">
            <div className="flex min-w-0 w-full gap-3 lg:flex-1">
              <div className={`h-8 w-24 ${bone}`} />
              <div className={`h-8 w-20 ${bone}`} />
            </div>
            <div className="hidden lg:block lg:w-1/2 lg:shrink-0" aria-hidden />
          </div>

      </div>
    </div>
  );
}

function ToolbarBone() {
  return (
    <div className="sticky top-1.5 z-20 flex w-full min-w-0 max-w-full items-center gap-1.5 rounded-rsi border border-rsi-border bg-rsi-surface/90 px-2.5 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:gap-2 sm:px-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <div className={`h-3 w-10 ${bone}`} />
        <div className={`h-6 w-14 ${bone}`} />
        <div className={`h-6 w-12 ${bone}`} />
        <div className={`h-6 w-16 ${bone}`} />
      </div>
      <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
        <div className={`h-3 w-10 ${bone}`} />
        <div className={`h-6 w-16 ${bone}`} />
        <div className={`h-6 w-12 ${bone}`} />
        <div className={`h-9 w-9 ${bone}`} />
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
  cards = 2,
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
            <div
              key={index}
              className="flex w-full flex-col items-center gap-1.5"
            >
              <div className={`h-2.5 w-12 ${bone}`} />
              <StopThumbBone />
              {index < railStops - 1 ? (
                <div className={`my-0.5 h-3 w-0.5 ${bone}`} />
              ) : null}
            </div>
          ))}
        </div>
      </aside>

      <div
        aria-hidden
        className="flex min-w-0 max-w-full flex-1 flex-col gap-1.5"
      >
        <ToolbarBone />

        <div className="min-w-0 max-w-full flex-1 overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface/90 shadow-rsi-panel">
          {/* Mobile Stops band */}
          <div className="border-b border-rsi-divider/60 bg-rsi-bg-deep/40 px-3 py-3 lg:hidden">
            <div className={`mb-3 h-3 w-28 ${bone}`} />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: Math.min(railStops, 4) }, (_, index) => (
                <div
                  key={index}
                  className="flex w-[5.75rem] shrink-0 flex-col items-center gap-1.5"
                >
                  <div className={`h-2 w-4 ${bone}`} />
                  <StopThumbBone />
                  <div className={`h-2.5 w-14 ${bone}`} />
                </div>
              ))}
            </div>
          </div>

          {Array.from({ length: cards }, (_, index) => (
            <StopCardBone key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
