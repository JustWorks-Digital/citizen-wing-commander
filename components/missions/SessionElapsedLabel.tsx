"use client";

import { useEffect, useState } from "react";
import {
  formatSessionDuration,
  getSessionElapsedMs,
  type SessionChecklistModel,
} from "@/lib/missions/mockSession";

export type SessionElapsedLabelProps = {
  session: Pick<SessionChecklistModel, "startedAt" | "completedAt">;
};

/**
 * Live session timer — owns its 1s tick so the parent (cargo grid / checklist)
 * does not re-render every second.
 */
export function SessionElapsedLabel({ session }: SessionElapsedLabelProps) {
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

  return (
    <p
      className={[
        "font-mono text-[0.65rem] uppercase tracking-[0.14em] tabular-nums",
        isComplete ? "text-rsi-success" : "text-rsi-text-secondary",
      ].join(" ")}
      title="Total time"
    >
      <span className="text-rsi-text-muted">Time </span>
      {label}
      {isComplete ? " · done" : ""}
    </p>
  );
}
