import { getAppVersionInfo } from "@/lib/appVersion";

export type AppVersionMarkProps = {
  className?: string;
};

/**
 * Discrete build identity (git SHA) so local vs prod can be compared at a glance.
 */
export function AppVersionMark({ className }: AppVersionMarkProps) {
  const { gitSha, label } = getAppVersionInfo();
  const display = gitSha ?? "dev";

  return (
    <p
      className={[
        "pointer-events-none fixed right-3 bottom-2 z-[40] select-none",
        "font-mono text-[0.55rem] tabular-nums tracking-[0.14em]",
        "text-rsi-text-muted/45",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={`Citizen Wing Commander ${label}`}
      aria-label={`App build ${label}`}
    >
      {display}
    </p>
  );
}
