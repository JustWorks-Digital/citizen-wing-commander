"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { SessionTabSummary } from "@/lib/missions/sessionChecklist";
import {
  readRecentSessionIds,
  recordRecentSessionView,
  removeRecentSessionView,
} from "@/lib/sessions/recentSessionViews";
import { formatTimeAgo } from "@/lib/ui/formatTimeAgo";
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

type OpenMenu = "all" | "recent" | null;

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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={[
        "size-3.5 shrink-0 transition-transform",
        open ? "rotate-180" : "",
      ].join(" ")}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/** Newest created first. */
function sortByCreatedDesc(
  sessions: SessionTabSummary[],
): SessionTabSummary[] {
  return [...sessions].sort((a, b) => {
    const aTime = Date.parse(a.createdAt) || 0;
    const bTime = Date.parse(b.createdAt) || 0;
    return bTime - aTime;
  });
}

type SessionMenuProps = {
  label: string;
  ariaLabel: string;
  open: boolean;
  onToggle: () => void;
  onCloseMenu: () => void;
  disabled?: boolean;
  emptyLabel?: string;
  items: SessionTabSummary[];
  nowMs: number;
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onRequestClose?: (session: SessionTabSummary) => void;
  isBusy?: boolean;
};

function SessionMenu({
  label,
  ariaLabel,
  open,
  onToggle,
  onCloseMenu,
  disabled = false,
  emptyLabel = "No trips",
  items,
  nowMs,
  activeSessionId,
  onSelect,
  onRequestClose,
  isBusy = false,
}: SessionMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onCloseMenu();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseMenu();
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onCloseMenu]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        title={ariaLabel}
        disabled={disabled || isBusy}
        onClick={onToggle}
        className={[
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-rsi border border-rsi-border bg-rsi-bg-deep/50 px-2.5 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-rsi-text-secondary transition-colors",
          "hover:border-rsi-border-strong hover:bg-rsi-surface/60 hover:text-rsi-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
          open ? "border-rsi-border-strong bg-rsi-surface/60 text-rsi-text" : "",
          disabled || isBusy ? "opacity-60" : "",
        ].join(" ")}
      >
        {label}
        <Chevron open={open} />
      </button>
      {open ? (
        <div
          id={listId}
          role="menu"
          aria-label={ariaLabel}
          className="absolute top-full left-0 z-40 mt-1.5 max-h-72 w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-rsi border border-rsi-border bg-rsi-surface py-1 shadow-rsi-panel"
        >
          {items.length === 0 ? (
            <p className="px-3 py-2 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-rsi-text-muted">
              {emptyLabel}
            </p>
          ) : (
            items.map((tab) => {
              const isActive = tab.id === activeSessionId;
              return (
                <div
                  key={tab.id}
                  role="none"
                  className="group relative flex items-stretch"
                >
                  <button
                    type="button"
                    role="menuitem"
                    disabled={isBusy}
                    title={`${tab.sessionName} · created ${formatTimeAgo(tab.createdAt, nowMs)} (${tab.id})`}
                    onClick={() => {
                      onSelect(tab.id);
                      onCloseMenu();
                    }}
                    className={[
                      "flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left transition-colors",
                      "hover:bg-rsi-bg-deep/70",
                      "focus-visible:outline-none focus-visible:bg-rsi-bg-deep/70",
                      isActive ? "bg-rsi-accent/10" : "",
                    ].join(" ")}
                  >
                    <SessionGlyph active={isActive} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium leading-tight text-rsi-text">
                        {tab.sessionName}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[0.6rem] tracking-wide text-rsi-text-muted tabular-nums">
                        {formatTimeAgo(tab.createdAt, nowMs)}
                        {isActive ? " · open" : ""}
                      </span>
                    </span>
                  </button>
                  {onRequestClose ? (
                    <button
                      type="button"
                      aria-label={`Close trip ${tab.sessionName}`}
                      title="Close trip"
                      disabled={isBusy}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRequestClose(tab);
                        onCloseMenu();
                      }}
                      className={[
                        "absolute top-1.5 right-1.5 inline-flex size-5 items-center justify-center rounded-sm text-rsi-text-muted transition-opacity",
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
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Active trip tile + All / Recent menus + create control. */
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
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const activeSession = useMemo(
    () => sessions.find((tab) => tab.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const otherSessions = useMemo(
    () =>
      sortByCreatedDesc(
        sessions.filter((tab) => tab.id !== activeSessionId),
      ),
    [sessions, activeSessionId],
  );

  const recentSessions = useMemo(() => {
    const byId = new Map(sessions.map((tab) => [tab.id, tab]));
    return recentIds
      .map((id) => byId.get(id))
      .filter((tab): tab is SessionTabSummary => Boolean(tab));
  }, [sessions, recentIds]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    setNowMs(Date.now());
    const youngestMs = sessions.reduce((min, tab) => {
      const t = Date.parse(tab.createdAt);
      if (Number.isNaN(t)) return min;
      return Math.min(min, Date.now() - t);
    }, Number.POSITIVE_INFINITY);
    const intervalMs =
      Number.isFinite(youngestMs) && youngestMs < 60_000 ? 1000 : 30_000;
    const tick = window.setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => window.clearInterval(tick);
  }, [sessions]);

  useEffect(() => {
    setRecentIds(readRecentSessionIds());
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    setRecentIds(recordRecentSessionView(activeSessionId));
  }, [activeSessionId]);

  useEffect(() => {
    if (!pendingClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPendingClose(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingClose]);

  const closeMenus = () => setOpenMenu(null);

  const requestClose = (tab: SessionTabSummary) => {
    setPendingClose(tab);
  };

  const confirmClose = (sessionId: string) => {
    setRecentIds(removeRecentSessionView(sessionId));
    onClose?.(sessionId);
  };

  return (
    <>
      <div
        role="tablist"
        aria-label="Hauling trips"
        className="flex min-w-0 max-w-full flex-wrap items-stretch gap-1"
      >
        {activeSession ? (
          <div
            className={[
              "group relative inline-flex min-w-0 max-w-[16rem] shrink-0 items-stretch sm:max-w-[18rem]",
              isBusy ? "opacity-60" : "",
            ].join(" ")}
          >
            <button
              type="button"
              role="tab"
              aria-selected
              disabled={isBusy}
              title={`${activeSession.sessionName} · created ${formatTimeAgo(activeSession.createdAt, nowMs)} (${activeSession.id})`}
              onClick={() => onSelect(activeSession.id)}
              className={[
                "inline-flex min-w-0 flex-1 items-center gap-1.5 rounded-rsi border border-rsi-accent/50 bg-rsi-surface-raised py-1.5 pr-7 pl-2.5 text-left text-rsi-text transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
              ].join(" ")}
            >
              <SessionGlyph active />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium leading-tight">
                  {activeSession.sessionName}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[0.6rem] tracking-wide text-rsi-text-muted tabular-nums">
                  {formatTimeAgo(activeSession.createdAt, nowMs)}
                </span>
              </span>
            </button>
            {onClose ? (
              <button
                type="button"
                aria-label={`Close trip ${activeSession.sessionName}`}
                title="Close trip"
                disabled={isBusy}
                onClick={(event) => {
                  event.stopPropagation();
                  requestClose(activeSession);
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
        ) : null}

        <SessionMenu
          label="Recent"
          ariaLabel="Recently viewed trips"
          open={openMenu === "recent"}
          onToggle={() =>
            setOpenMenu((current) => (current === "recent" ? null : "recent"))
          }
          onCloseMenu={closeMenus}
          disabled={recentSessions.length === 0}
          emptyLabel="No recent trips"
          items={recentSessions}
          nowMs={nowMs}
          activeSessionId={activeSessionId}
          onSelect={onSelect}
          onRequestClose={onClose ? requestClose : undefined}
          isBusy={isBusy}
        />

        <SessionMenu
          label={`All${otherSessions.length ? ` (${otherSessions.length})` : ""}`}
          ariaLabel="All other trips, sorted by creation date"
          open={openMenu === "all"}
          onToggle={() =>
            setOpenMenu((current) => (current === "all" ? null : "all"))
          }
          onCloseMenu={closeMenus}
          disabled={otherSessions.length === 0}
          emptyLabel="No other trips"
          items={otherSessions}
          nowMs={nowMs}
          activeSessionId={activeSessionId}
          onSelect={onSelect}
          onRequestClose={onClose ? requestClose : undefined}
          isBusy={isBusy}
        />

        <button
          type="button"
          aria-label="Add trip"
          title="Add trip"
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
              Close trip
            </p>
            <h2
              id="close-session-title"
              className="mt-2 text-base font-semibold tracking-wide text-rsi-text"
            >
              Delete this trip?
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
                  confirmClose(id);
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
