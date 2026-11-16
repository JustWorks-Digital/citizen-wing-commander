"use client";

import { useEffect, useState } from "react";
import { formatSessionDuration, getSessionElapsedMs, type SessionChecklist } from "@/lib/missions/sessionChecklist";


export type SessionElapsedLabelProps = {
  session: Pick<SessionChecklist, "startedAt" | "completedAt">;
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
  const isComplete = Boolean(session.completedAt);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (isComplete) return;
    setNowMs(Date.now());
    const tick = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(tick);
  }, [isComplete, session.startedAt, session.completedAt]);

  const label = formatSessionDuration(getSessionElapsedMs(session, nowMs));
  const display = `${label}${isComplete ? " · done" : ""}`;

  if (variant === "value") {
    return (
      <span
        className={isComplete ? "text-rsi-success" : undefined}
        title="Total time"
      >
        {display}
      </span>
    );
  }

  return (
    <p
      className={[
        "font-mono text-[0.65rem] uppercase tracking-[0.14em] tabular-nums",
        isComplete ? "text-rsi-success" : "text-rsi-text-secondary",
      ].join(" ")}
      title="Total time"
    >
      <span className="text-rsi-text-muted">Time </span>
      {display}
    </p>
  );
}
