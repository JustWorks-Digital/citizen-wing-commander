const bone =
  "rounded-rsi bg-rsi-surface-raised/80 animate-pulse";

function FilterFieldBone() {
  return (
    <div className="min-w-[8rem] flex-1 space-y-1.5">
      <div className={`h-2.5 w-10 ${bone}`} />
      <div className={`h-8 w-full ${bone}`} />
    </div>
  );
}

function TableRowBone() {
  return (
    <div className="flex items-center gap-3 border-b border-rsi-divider/60 px-2.5 py-2.5 sm:px-3">
      <div className={`size-3.5 shrink-0 ${bone}`} />
      <div className={`h-3 w-16 shrink-0 ${bone}`} />
      <div className={`h-3 flex-1 ${bone}`} />
      <div className={`hidden h-3 w-14 shrink-0 sm:block ${bone}`} />
      <div className={`hidden h-3 w-12 shrink-0 md:block ${bone}`} />
      <div className={`hidden h-3 w-8 shrink-0 lg:block ${bone}`} />
      <div className={`hidden h-3 w-20 shrink-0 lg:block ${bone}`} />
      <div className={`hidden h-3 w-20 shrink-0 xl:block ${bone}`} />
    </div>
  );
}

export type MissionCatalogSkeletonProps = {
  rows?: number;
  className?: string;
};

/** Filter + table placeholder while catalog missions load. */
export function MissionCatalogSkeleton({
  rows = 10,
  className,
}: MissionCatalogSkeletonProps) {
  return (
    <div
      className={["space-y-6", className].filter(Boolean).join(" ")}
      aria-hidden
    >
      <div className="space-y-3">
        <div className={`h-9 w-full max-w-md ${bone}`} />
        <div className="flex flex-wrap gap-3">
          <FilterFieldBone />
          <FilterFieldBone />
          <FilterFieldBone />
          <FilterFieldBone />
          <FilterFieldBone />
        </div>
        <div className={`h-2.5 w-28 ${bone}`} />
      </div>

      <div className="overflow-hidden rounded-rsi border border-rsi-border bg-rsi-bg-deep/30">
        <div className="flex items-center gap-3 border-b border-rsi-divider px-2.5 py-2 sm:px-3">
          <div className={`size-3.5 shrink-0 ${bone}`} />
          <div className={`h-2.5 w-10 ${bone}`} />
          <div className={`h-2.5 w-12 ${bone}`} />
          <div className={`hidden h-2.5 w-10 sm:block ${bone}`} />
          <div className={`ml-auto hidden h-2.5 w-14 md:block ${bone}`} />
        </div>
        {Array.from({ length: rows }, (_, index) => (
          <TableRowBone key={index} />
        ))}
      </div>
    </div>
  );
}
