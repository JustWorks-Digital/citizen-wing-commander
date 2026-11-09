import type { MobiglasContractPanel } from "@/lib/missions/mobiglasTranscript";

export type MobiglasMissionDetailProps = {
  panel: MobiglasContractPanel;
  screenshots?: string[];
};

function formatReward(panel: MobiglasContractPanel): string {
  if (panel.rewardDisplay?.trim()) return panel.rewardDisplay.trim();
  return `${panel.rewardAuec.toLocaleString("en-US")} aUEC`;
}

/** MobiGlas Contracts Manager–style detail panel. */
export function MobiglasMissionDetail({
  panel,
  screenshots = [],
}: MobiglasMissionDetailProps) {
  return (
    <div className="rounded-rsi border border-rsi-border bg-rsi-bg-deep/80 font-mono text-sm text-rsi-text shadow-rsi-panel">
      <div className="border-b border-rsi-divider px-4 py-3">
        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
          MobiGlas · Contracts
        </p>
        <p className="mt-1 text-xs text-rsi-text-muted">
          Tab: {panel.tab}
          {panel.acceptedCount ? ` (${panel.acceptedCount})` : ""}
        </p>
        <p className="text-xs text-rsi-text-muted">Category: {panel.category}</p>
      </div>

      <div className="space-y-3 border-b border-rsi-divider px-4 py-4">
        <h3 className="font-sans text-base font-semibold tracking-wide text-rsi-text">
          {panel.title}
        </h3>
        <p className="text-xs text-rsi-text-secondary">
          Contracted by:{" "}
          <span className="text-rsi-text">{panel.contractor}</span>
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-rsi-text-muted">Reward</dt>
          <dd className="text-rsi-accent">{formatReward(panel)}</dd>
          <dt className="text-rsi-text-muted">Time remaining</dt>
          <dd>{panel.timeRemaining ?? "—"}</dd>
          <dt className="text-rsi-text-muted">Deadline</dt>
          <dd>{panel.deadline ?? "N/A"}</dd>
        </dl>
      </div>

      <div className="space-y-2 border-b border-rsi-divider px-4 py-4">
        <p className="text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted">
          Details
        </p>
        <p className="font-sans text-sm leading-relaxed text-rsi-text-secondary">
          {panel.details}
        </p>
        {panel.contact ? (
          <p className="text-xs text-rsi-text-muted">Contact: {panel.contact}</p>
        ) : null}
      </div>

      <div className="space-y-2 px-4 py-4">
        <p className="text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted">
          Primary objectives
        </p>
        <ul className="space-y-3">
          {panel.objectives.map((objective) => (
            <li key={objective.label} className="text-sm">
              <p className="text-rsi-text">
                ☐ {objective.label}
                {objective.progressTotal != null
                  ? ` [${objective.progressCurrent ?? 0}/${objective.progressTotal}]`
                  : ""}
              </p>
              {objective.children?.length ? (
                <ul className="mt-1 space-y-0.5 pl-5 text-xs text-rsi-text-secondary">
                  {objective.children.map((child) => (
                    <li key={child}>· {child}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {screenshots.length > 0 ? (
        <div className="border-t border-rsi-divider px-4 py-3 text-xs text-rsi-text-muted">
          <p className="mb-1 text-[0.65rem] uppercase tracking-[0.18em]">
            Source screenshots
          </p>
          <ul className="space-y-0.5">
            {screenshots.map((shot) => (
              <li key={shot}>{shot}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
