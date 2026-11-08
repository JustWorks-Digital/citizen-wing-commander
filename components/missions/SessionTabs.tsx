"use client";

import type { SessionTabSummary } from "@/lib/sessions/checklistStore";

export type SessionTabsProps = {
  sessions: SessionTabSummary[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  isBusy?: boolean;
};

function SessionGlyph({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className={[
        "size-3.5 shrink-0",
        active ? "text-rsi-accent" : "text-rsi-text-muted",
      ].join(" ")}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="2.5"
        y="3.5"
        width="11"
        height="9"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M5 6.5h6M5 9h4"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Open session tabs + create control for multi-session hauling. */
export function SessionTabs({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  isBusy = false,
}: SessionTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Hauling sessions"
      className="flex min-w-0 items-stretch gap-1 overflow-x-auto pb-0.5"
    >
      {sessions.map((tab) => {
        const isActive = tab.id === activeSessionId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={isBusy}
            title={`${tab.sessionName} (${tab.id})`}
            onClick={() => onSelect(tab.id)}
            className={[
              "inline-flex max-w-[11rem] shrink-0 items-center gap-1.5 rounded-rsi border px-2.5 py-1.5 text-left transition-colors sm:max-w-[14rem]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
              isActive
                ? "border-rsi-accent/50 bg-rsi-surface-raised text-rsi-text"
                : "border-rsi-border bg-rsi-bg-deep/50 text-rsi-text-secondary hover:border-rsi-border-strong hover:bg-rsi-surface/60",
              isBusy ? "opacity-60" : "",
            ].join(" ")}
          >
            <SessionGlyph active={isActive} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium leading-tight">
                {tab.sessionName}
              </span>
              <span className="mt-0.5 block truncate font-mono text-[0.6rem] tracking-wide text-rsi-text-muted">
                {tab.id}
              </span>
            </span>
          </button>
        );
      })}
      <button
        type="button"
        aria-label="Add session"
        title="Add session"
        disabled={isBusy}
        onClick={onCreate}
        className={[
          "inline-flex size-9 shrink-0 items-center justify-center rounded-rsi border border-dashed border-rsi-border text-rsi-text-muted transition-colors",
          "hover:border-rsi-accent hover:bg-rsi-surface/50 hover:text-rsi-accent",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
          isBusy ? "opacity-60" : "",
        ].join(" ")}
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="size-4"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M8 3.5v9M3.5 8h9"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
