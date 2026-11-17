"use client";

import { useEffect, useState } from "react";
import { formatSessionDuration, getSessionElapsedMs, type SessionChecklist } from "@/lib/missions/sessionChecklist";


export type SessionElapsedLabelProps = {
  session: Pick<
    SessionChecklist,
    "startedAt" | "completedAt" | "finishStatus"
  >;
  /**
   * `default` — “Time …” line for the ⋯ menu.
   * `value` — duration only for the route toolbar Time cell.
   */
  variant?: "default" | "value";
};

/**
 * Live session timer — owns its 1s tick so the parent (cargo grid / checklist)
 * does not re-render every second.
 */
export function SessionElapsedLabel({
  session,
  variant = "default",
}: SessionElapsedLabelProps) {
  const isCrashed = session.finishStatus === "crash";
  const isComplete = Boolean(session.completedAt) || isCrashed;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (isComplete) return;
    setNowMs(Date.now());
    const tick = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(tick);
  }, [isComplete, session.startedAt, session.completedAt, session.finishStatus]);

  const label = formatSessionDuration(getSessionElapsedMs(session, nowMs));
  const suffix = isCrashed ? " · crash" : isComplete ? " · done" : "";
  const display = `${label}${suffix}`;
  const toneClass = isCrashed
    ? "text-rsi-danger"
    : isComplete
      ? "text-rsi-success"
      : undefined;

  if (variant === "value") {
    return (
      <span className={toneClass} title="Total time">
        {display}
      </span>
    );
  }

  return (
    <p
      className={[
        "font-mono text-[0.65rem] uppercase tracking-[0.14em] tabular-nums",
        toneClass ?? "text-rsi-text-secondary",
      ].join(" ")}
      title="Total time"
    >
      <span className="text-rsi-text-muted">Time </span>
      {display}
    </p>
  );
}
