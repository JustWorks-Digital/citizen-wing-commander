const bone = "rounded-rsi bg-rsi-surface-raised/80 animate-pulse";

const thClass =
  "px-3 py-2 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-muted";
const tdClass = "px-3 py-2.5 align-middle";

function CardBone() {
  return (
    <div className="rounded-rsi border border-rsi-border/60 bg-rsi-bg-deep/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <div className={`h-2.5 w-14 ${bone}`} />
          <div className={`h-3.5 w-[75%] max-w-[14rem] ${bone}`} />
          <div className="flex flex-wrap gap-1.5">
            <div className={`h-5 w-16 ${bone}`} />
            <div className={`h-5 w-14 ${bone}`} />
          </div>
        </div>
        <div className={`size-7 shrink-0 ${bone}`} />
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-rsi-border/50 pt-2.5">
        <div className={`h-8 ${bone}`} />
        <div className={`h-8 ${bone}`} />
        <div className={`h-8 ${bone}`} />
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-3">
        <div className={`h-6 ${bone}`} />
        <div className={`h-6 ${bone}`} />
      </div>
    </div>
  );
}

function TableRowBone() {
  return (
    <tr className="border-b border-rsi-divider/60">
      <td className={tdClass}>
        <div className={`h-3 w-14 ${bone}`} />
      </td>
      <td className={`${tdClass} max-w-[12rem]`}>
        <div className={`h-3 w-40 max-w-full ${bone}`} />
        <div className={`mt-1.5 h-5 w-24 ${bone}`} />
      </td>
      <td className={tdClass}>
        <div className="flex justify-end">
          <div className={`h-3 w-16 ${bone}`} />
        </div>
      </td>
      <td className={tdClass}>
        <div className="flex justify-end">
          <div className={`h-3 w-10 ${bone}`} />
        </div>
      </td>
      <td className={tdClass}>
        <div className="flex justify-end">
          <div className={`h-3 w-12 ${bone}`} />
        </div>
      </td>
      <td className={`${tdClass} max-w-[9rem]`}>
        <div className={`h-5 w-20 ${bone}`} />
      </td>
      <td className={`${tdClass} max-w-[9rem]`}>
        <div className={`h-5 w-20 ${bone}`} />
      </td>
      <td className={tdClass}>
        <div className={`h-6 w-24 ${bone}`} />
      </td>
      <td className={`${tdClass} w-10`}>
        <div className={`size-7 ${bone}`} />
      </td>
    </tr>
  );
}

export type SessionAcceptedContractsSkeletonProps = {
  rows?: number;
  className?: string;
};

/** Accepted Contracts modal table/cards placeholder while rows paint. */
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

      <div className="space-y-2.5 p-3 pb-4 md:hidden" aria-hidden>
        {Array.from({ length: count }, (_, index) => (
          <CardBone key={index} />
        ))}
      </div>

      <table
        className="hidden w-full min-w-[40rem] border-collapse text-left md:table"
        aria-hidden
      >
        <thead className="sticky top-0 z-10 border-b border-rsi-border bg-rsi-surface">
          <tr>
            <th className={`${thClass} whitespace-nowrap`}>
              <div className={`h-2.5 w-10 ${bone}`} />
            </th>
            <th className={`${thClass} max-w-[12rem]`}>
              <div className={`h-2.5 w-12 ${bone}`} />
            </th>
            <th className={`${thClass} whitespace-nowrap`}>
              <div className="flex justify-end">
                <div className={`h-2.5 w-12 ${bone}`} />
              </div>
            </th>
            <th className={`${thClass} whitespace-nowrap`}>
              <div className="flex justify-end">
                <div className={`h-2.5 w-8 ${bone}`} />
              </div>
            </th>
            <th className={`${thClass} whitespace-nowrap`}>
              <div className="flex justify-end">
                <div className={`h-2.5 w-8 ${bone}`} />
              </div>
            </th>
            <th className={`${thClass} max-w-[9rem]`}>
              <div className={`h-2.5 w-10 ${bone}`} />
            </th>
            <th className={`${thClass} max-w-[9rem]`}>
              <div className={`h-2.5 w-8 ${bone}`} />
            </th>
            <th className={`${thClass} whitespace-nowrap`}>
              <div className={`h-2.5 w-12 ${bone}`} />
            </th>
            <th className={`${thClass} w-10`}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: count }, (_, index) => (
            <TableRowBone key={index} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
