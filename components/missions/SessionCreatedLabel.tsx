"use client";

import { useEffect, useState } from "react";
import { formatTimeAgo } from "@/lib/ui/formatTimeAgo";

export type SessionCreatedLabelProps = {
  createdAt: string;
  className?: string;
};

/**
 * Live “created … ago” label — owns its tick so parents don’t re-render every second.
 * Seconds tick while under 1m; then every 30s.
 */
export function SessionCreatedLabel({
  createdAt,
  className,
}: SessionCreatedLabelProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
    const ageMs = Date.now() - (Date.parse(createdAt) || Date.now());
    const intervalMs = ageMs < 60_000 ? 1000 : 30_000;
    const tick = window.setInterval(() => {
      setNowMs(Date.now());
    }, intervalMs);
    return () => window.clearInterval(tick);
  }, [createdAt]);

  const label = formatTimeAgo(createdAt, nowMs);
  const absolute = (() => {
    const ms = Date.parse(createdAt);
    return Number.isNaN(ms) ? createdAt : new Date(ms).toLocaleString();
  })();

  return (
    <p
      className={[
        "font-mono text-[0.65rem] tracking-wide text-rsi-text-muted tabular-nums",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={`Created ${absolute}`}
    >
      <span className="uppercase tracking-[0.14em] text-rsi-text-muted/80">
        Created{" "}
      </span>
      {label}
    </p>
  );
}
