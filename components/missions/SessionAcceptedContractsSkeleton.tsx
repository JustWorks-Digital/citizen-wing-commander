const bone = "rounded-rsi bg-rsi-surface-raised/80 animate-pulse";

function CardBone() {
  return (
    <div className="rounded-rsi border border-rsi-border/60 bg-rsi-bg-deep/25 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-5 ${bone}`} />
            <div className={`h-2.5 w-16 ${bone}`} />
          </div>
          <div className={`h-3.5 w-[70%] ${bone}`} />
          <div className={`h-2.5 w-28 ${bone}`} />
          <div className="flex flex-wrap gap-1.5">
            <div className={`h-5 w-20 ${bone}`} />
            <div className={`h-5 w-16 ${bone}`} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className={`h-5 w-14 ${bone}`} />
            <div className={`h-2 w-3 ${bone}`} />
            <div className={`h-5 w-14 ${bone}`} />
          </div>
          <div className="flex gap-1.5 pt-1">
            <div className={`h-8 w-16 ${bone}`} />
            <div className={`h-8 w-24 ${bone}`} />
          </div>
        </div>
        <div className={`size-8 shrink-0 ${bone}`} />
      </div>
    </div>
  );
}

export type SessionAcceptedContractsSkeletonProps = {
  rows?: number;
  className?: string;
};

/** Accepted Contracts modal card-list placeholder while contracts paint. */
export function SessionAcceptedContractsSkeleton({
  rows = 5,
  className,
}: SessionAcceptedContractsSkeletonProps) {
  const count = Math.max(1, rows);
  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading contracts…</span>
      <div
        className="grid grid-cols-1 gap-2 p-3 pb-4 sm:grid-cols-2 sm:px-4 sm:pb-5"
        aria-hidden
      >
        {Array.from({ length: count }, (_, index) => (
          <CardBone key={index} />
        ))}
      </div>
    </div>
  );
}
