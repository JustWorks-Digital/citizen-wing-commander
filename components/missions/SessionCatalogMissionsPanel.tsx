"use client";

import { Suspense } from "react";
import { MissionsCatalogView } from "@/components/catalog/MissionsCatalogView";
import { MissionCatalogSkeleton } from "@/components/catalog/MissionCatalogSkeleton";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import type { AddCatalogMissionsToSessionResult } from "@/lib/api/catalogMissionsApi";

export type SessionCatalogMissionsPanelProps = {
  open: boolean;
  sessionId: string;
  sessionName?: string;
  onClose: () => void;
  onAdded?: (result: AddCatalogMissionsToSessionResult) => void;
};

/** Modal: browse the contracts catalog and add selections to this trip. */
export function SessionCatalogMissionsPanel({
  open,
  sessionId,
  sessionName,
  onClose,
  onAdded,
}: SessionCatalogMissionsPanelProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-rsi-bg-deep/80 px-3 pt-14 pb-3 backdrop-blur-sm sm:items-center sm:px-4 sm:pt-14 sm:pb-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add catalog contracts"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative flex h-[calc(100dvh-4.25rem)] w-full max-w-7xl sm:h-[92vh] sm:w-max sm:max-w-[min(100%,72rem)] sm:min-w-[min(100%,24rem)]">
        <ModalCloseButton label="Close contracts catalog" onClick={onClose} />
        <div className="flex h-full w-full flex-col overflow-hidden border-rsi-border bg-rsi-surface shadow-rsi-panel sm:rounded-rsi sm:border">
        <header className="shrink-0 border-b border-rsi-divider px-4 py-3 sm:px-5 sm:py-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
            Catalog
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-wide text-rsi-text sm:text-lg">
            Add contracts
            {sessionName ? (
              <span className="font-normal text-rsi-text-muted">
                {" "}
                · {sessionName}
              </span>
            ) : null}
          </h2>
          <p className="mt-1 text-xs text-rsi-text-muted">
            Select catalog rows, then Add to trip (this trip) or Create new
            trip.
          </p>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-5 sm:py-5">
          <Suspense fallback={<MissionCatalogSkeleton />}>
            <MissionsCatalogView
              persistUrlState={false}
              showHeading={false}
              targetSessionId={sessionId}
              onAdded={onAdded}
            />
          </Suspense>
        </div>
        </div>
      </div>
    </div>
  );
}
