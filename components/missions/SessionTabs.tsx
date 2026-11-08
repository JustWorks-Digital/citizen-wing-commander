"use client";

import { useEffect, useState } from "react";
import type { SessionTabSummary } from "@/lib/missions/sessionChecklist";
import { Button } from "@/components/ui/Button";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";

export type SessionTabsProps = {
  sessions: SessionTabSummary[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
  /** Soft-delete / close a session after user confirms. */
  onClose?: (sessionId: string) => void;
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
  onClose,
  isBusy = false,
}: SessionTabsProps) {
  const [pendingClose, setPendingClose] = useState<SessionTabSummary | null>(
    null,
  );

  useEffect(() => {
    if (!pendingClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPendingClose(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingClose]);

  return (
    <>
      <div
        role="tablist"
        aria-label="Hauling sessions"
        className="flex min-w-0 items-stretch gap-1 overflow-x-auto pb-0.5"
      >
        {sessions.map((tab) => {
          const isActive = tab.id === activeSessionId;
          return (
            <div
              key={tab.id}
              className={[
                "group relative inline-flex max-w-[11rem] shrink-0 items-stretch sm:max-w-[14rem]",
                isBusy ? "opacity-60" : "",
              ].join(" ")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={isBusy}
                title={`${tab.sessionName} (${tab.id})`}
                onClick={() => onSelect(tab.id)}
                className={[
                  "inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-rsi border py-1.5 pr-7 pl-2.5 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
                  isActive
                    ? "border-rsi-accent/50 bg-rsi-surface-raised text-rsi-text"
                    : "border-rsi-border bg-rsi-bg-deep/50 text-rsi-text-secondary hover:border-rsi-border-strong hover:bg-rsi-surface/60",
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
              {onClose ? (
                <button
                  type="button"
                  aria-label={`Close session ${tab.sessionName}`}
                  title="Close session"
                  disabled={isBusy}
                  onClick={(event) => {
                    event.stopPropagation();
                    setPendingClose(tab);
                  }}
                  className={[
                    "absolute top-1 right-1 inline-flex size-5 items-center justify-center rounded-sm text-rsi-text-muted transition-opacity",
                    "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100",
                    "hover:bg-rsi-danger-muted hover:text-rsi-danger",
                    "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                  ].join(" ")}
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 16 16"
                    className="size-3"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4.5 4.5l7 7M11.5 4.5l-7 7"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              ) : null}
            </div>
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

      {pendingClose ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-rsi-bg-deep/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-session-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPendingClose(null);
          }}
        >
          <div className="relative w-full max-w-sm rounded-rsi border border-rsi-border bg-rsi-surface p-5 pr-12 shadow-rsi-panel sm:pr-14">
            <ModalCloseButton
              label="Dismiss"
              onClick={() => setPendingClose(null)}
              disabled={isBusy}
            />
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
              Close session
            </p>
            <h2
              id="close-session-title"
              className="mt-2 text-base font-semibold tracking-wide text-rsi-text"
            >
              Delete this session?
            </h2>
            <p className="mt-2 text-sm text-rsi-text-secondary">
              <span className="font-medium text-rsi-text">
                {pendingClose.sessionName}
              </span>{" "}
              will be removed from your tabs. This cannot be undone from the UI.
            </p>
            <p className="mt-1 font-mono text-[0.6rem] tracking-wide text-rsi-text-muted">
              {pendingClose.id}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                disabled={isBusy}
                onClick={() => setPendingClose(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={isBusy}
                onClick={() => {
                  const id = pendingClose.id;
                  setPendingClose(null);
                  onClose?.(id);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
