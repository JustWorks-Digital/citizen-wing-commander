"use client";

import { useState } from "react";
import type { CatalogMission } from "@/db/schema";
import {
  asJsonValue,
  CollapsibleJsonTree,
} from "@/components/ui/CollapsibleJsonTree";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";

export type MissionCatalogJsonModalProps = {
  mission: CatalogMission;
  onClose: () => void;
};

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

export function MissionCatalogJsonModal({
  mission,
  onClose,
}: MissionCatalogJsonModalProps) {
  const json = JSON.stringify(mission, null, 2);
  const [isCopied, setIsCopied] = useState(false);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      // Clipboard may be blocked.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-rsi-bg-deep/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Contract JSON"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden border-rsi-border bg-rsi-surface shadow-rsi-panel sm:h-auto sm:max-h-[90vh] sm:rounded-rsi sm:border">
        <header className="relative border-b border-rsi-divider px-4 py-3 pr-12 sm:px-5 sm:py-4 sm:pr-14">
          <ModalCloseButton onClick={onClose} />
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
            Catalog · JSON
          </p>
          <h2 className="mt-1 truncate text-base font-semibold tracking-wide text-rsi-text sm:text-lg">
            {mission.title}
          </h2>
          <p className="mt-1 font-mono text-[0.7rem] text-rsi-text-muted">
            {mission.id}
          </p>
        </header>

        <div className="relative flex min-h-0 flex-1 flex-col bg-rsi-bg-deep p-3 sm:p-4">
          <button
            type="button"
            title={isCopied ? "Copied" : "Copy JSON"}
            aria-label={isCopied ? "Copied" : "Copy JSON object"}
            onClick={() => void copyJson()}
            className={[
              "absolute top-5 right-5 z-10 inline-flex size-9 items-center justify-center rounded-rsi",
              "border border-rsi-border bg-rsi-surface/90 text-rsi-text-muted shadow-rsi-panel backdrop-blur-sm",
              "transition-colors hover:border-rsi-accent/50 hover:text-rsi-accent",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
              "sm:top-6 sm:right-6",
              isCopied ? "text-rsi-accent" : "",
            ].join(" ")}
          >
            {isCopied ? (
              <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em]">
                OK
              </span>
            ) : (
              <CopyIcon className="size-4" />
            )}
          </button>
          <div
            className={[
              "min-h-0 flex-1 overflow-auto rounded-rsi border border-rsi-border/80",
              "bg-rsi-bg px-5 py-4 pr-14 pl-6 shadow-inner sm:px-6 sm:pr-16 sm:pl-8",
            ].join(" ")}
          >
            <CollapsibleJsonTree value={asJsonValue(mission)} />
          </div>
        </div>
      </div>
    </div>
  );
}
