"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import {
  addCatalogMissionsToSession,
  type AddCatalogMissionsToSessionResult,
} from "@/lib/api/catalogMissionsApi";
import {
  fetchChecklistSessions,
  type ChecklistSessionsList,
} from "@/lib/api/checklistApi";

export type AddCatalogMissionsToSessionModalProps = {
  catalogMissionIds: string[];
  onClose: () => void;
  onAdded?: (result: AddCatalogMissionsToSessionResult) => void;
};

type Mode = "existing" | "new";

/**
 * Pick an open hauling trip (or create one) and append catalog contracts.
 */
export function AddCatalogMissionsToSessionModal({
  catalogMissionIds,
  onClose,
  onAdded,
}: AddCatalogMissionsToSessionModalProps) {
  const [sessions, setSessions] = useState<ChecklistSessionsList | null>(null);
  const [mode, setMode] = useState<Mode>("existing");
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionName, setSessionName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchChecklistSessions();
        if (cancelled) return;
        setSessions(list);
        setSessionId(list.activeSessionId || list.sessions[0]?.id || "");
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load trips",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const count = catalogMissionIds.length;
  const canSubmit =
    !isSaving &&
    count > 0 &&
    (mode === "new" || Boolean(sessionId)) &&
    !isLoading;

  const submit = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await addCatalogMissionsToSession(
        mode === "new"
          ? {
              catalogMissionIds,
              createSession: true,
              sessionName: sessionName.trim() || undefined,
            }
          : {
              catalogMissionIds,
              sessionId,
            },
      );
      onAdded?.(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add contracts");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-rsi-bg-deep/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add contracts to trip"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative flex w-full max-w-md flex-col overflow-hidden border-rsi-border bg-rsi-surface shadow-rsi-panel sm:rounded-rsi sm:border">
        <header className="relative border-b border-rsi-divider px-4 py-3 pr-12 sm:px-5 sm:py-4 sm:pr-14">
          <ModalCloseButton onClick={onClose} />
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
            Catalog · Trip
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-wide text-rsi-text">
            Add {count} contract{count === 1 ? "" : "s"}
          </h2>
        </header>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={[
                "flex-1 rounded-rsi border px-3 py-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] transition-colors",
                mode === "existing"
                  ? "border-rsi-accent/50 bg-rsi-accent/10 text-rsi-accent"
                  : "border-rsi-border text-rsi-text-muted hover:text-rsi-text",
              ].join(" ")}
            >
              Existing trip
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={[
                "flex-1 rounded-rsi border px-3 py-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] transition-colors",
                mode === "new"
                  ? "border-rsi-accent/50 bg-rsi-accent/10 text-rsi-accent"
                  : "border-rsi-border text-rsi-text-muted hover:text-rsi-text",
              ].join(" ")}
            >
              New trip
            </button>
          </div>

          {mode === "existing" ? (
            <label className="block">
              <span className="mb-1 block font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
                Trip
              </span>
              {isLoading ? (
                <p className="text-xs text-rsi-text-muted">Loading…</p>
              ) : (
                <select
                  value={sessionId}
                  onChange={(event) => setSessionId(event.target.value)}
                  className="w-full rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 px-2.5 py-2 text-xs text-rsi-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]"
                >
                  {(sessions?.sessions ?? []).map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.sessionName}
                      {session.id === sessions?.activeSessionId
                        ? " (active)"
                        : ""}{" "}
                      · {session.missionCount} contract
                      {session.missionCount === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              )}
            </label>
          ) : (
            <label className="block">
              <span className="mb-1 block font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
                Trip name
              </span>
              <input
                type="text"
                value={sessionName}
                onChange={(event) => setSessionName(event.target.value)}
                placeholder="New trip"
                className="w-full rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 px-2.5 py-2 text-xs text-rsi-text placeholder:text-rsi-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]"
              />
            </label>
          )}

          {error ? <p className="text-sm text-rsi-warn">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void submit()}
              disabled={!canSubmit}
            >
              {isSaving ? "Adding…" : "Add to trip"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
