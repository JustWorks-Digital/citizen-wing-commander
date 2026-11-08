/**
 * Normalized MobiGlas Contracts Manager transcript.
 * Preserves the on-screen contract layout as structured text/JSON and
 * points back at the source screenshot(s).
 */

export type MobiglasContractObjective = {
  /** Primary objective line as shown (e.g. Deliver 0/96 SCU of Stims…). */
  label: string;
  progressCurrent?: number;
  progressTotal?: number;
  /** Nested Collect / sub-task lines under the objective. */
  children?: string[];
};

export type MobiglasContractPanel = {
  tab: string;
  acceptedCount?: string;
  category: string;
  title: string;
  contractor: string;
  rewardAuec: number;
  /** Sidebar / header short form when different (e.g. "80k"). */
  rewardDisplay?: string;
  timeRemaining?: string | null;
  deadline?: string | null;
  details: string;
  contact?: string;
  objectives: MobiglasContractObjective[];
};

export type MobiglasContractTranscript = {
  kind: "mobiglas_contract_transcript";
  version: 1;
  /** Stable id shared with intake contract `id`. */
  id: string;
  /**
   * Logical screenshot paths in the ephemeral MCP store
   * (`.data/mcp-screenshots/<batchId>/<file>` → store as `<batchId>/<file>`).
   * Uploaded via `store_hauling_screenshot`; not committed to git.
   */
  screenshots: string[];
  /** Root of the screenshot store when known (usually `.data/mcp-screenshots`). */
  screenshotStore?: string;
  /** Screenshot capture / file timestamp when known. */
  capturedAt?: string;
  /** Optional link back to the hauling intake contract id. */
  intakeContractId?: string;
  mobiglas: MobiglasContractPanel;
};

export function isMobiglasContractTranscript(
  value: unknown,
): value is MobiglasContractTranscript {
  if (!value || typeof value !== "object") return false;
  const v = value as MobiglasContractTranscript;
  return (
    v.kind === "mobiglas_contract_transcript" &&
    v.version === 1 &&
    typeof v.id === "string" &&
    Array.isArray(v.screenshots) &&
    Boolean(v.mobiglas)
  );
}

function formatReward(panel: MobiglasContractPanel): string {
  if (panel.rewardDisplay) {
    return `${panel.rewardDisplay} (${panel.rewardAuec.toLocaleString("en-US")} aUEC)`;
  }
  return `${panel.rewardAuec.toLocaleString("en-US")} aUEC`;
}

/** MobiGlas-like plain text for humans / AI context. */
export function formatMobiglasTranscript(
  transcript: MobiglasContractTranscript,
): string {
  const m = transcript.mobiglas;
  const lines: string[] = [
    "┌─ MOBIGLAS · CONTRACTS ─────────────────────────────────────",
    `│ Tab: ${m.tab}${m.acceptedCount ? ` (${m.acceptedCount})` : ""}`,
    `│ Category: ${m.category}`,
    "├─ CONTRACT ─────────────────────────────────────────────────",
    `│ ${m.title}`,
    `│ Contracted by: ${m.contractor}`,
    `│ Reward: ${formatReward(m)}`,
    `│ Time remaining: ${m.timeRemaining ?? "—"}`,
    `│ Deadline: ${m.deadline ?? "N/A"}`,
    "├─ DETAILS ──────────────────────────────────────────────────",
    ...m.details.split(/\n+/).map((p) => `│ ${p}`),
  ];
  if (m.contact) {
    lines.push(`│ Contact: ${m.contact}`);
  }
  lines.push("├─ PRIMARY OBJECTIVES ───────────────────────────────────────");
  for (const objective of m.objectives) {
    const progress =
      objective.progressTotal != null
        ? ` [${objective.progressCurrent ?? 0}/${objective.progressTotal}]`
        : "";
    lines.push(`│ ☐ ${objective.label}${progress}`);
    for (const child of objective.children ?? []) {
      lines.push(`│     · ${child}`);
    }
  }
  lines.push("├─ SOURCE SCREENSHOTS (MCP temp store) ──────────────────────");
  if (transcript.screenshotStore) {
    lines.push(`│ store: ${transcript.screenshotStore}`);
  }
  for (const shot of transcript.screenshots) {
    lines.push(`│ ${shot}`);
  }
  lines.push("└────────────────────────────────────────────────────────────");
  return lines.join("\n");
}
