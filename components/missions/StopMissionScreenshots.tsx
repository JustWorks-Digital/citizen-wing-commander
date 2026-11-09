"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import type { RowMissionScreenshotRef } from "@/lib/missions/rowMissionScreenshots";

export type StopMissionScreenshotsProps = {
  refs: RowMissionScreenshotRef[];
  className?: string;
};

/**
 * Compact screenshot references for missions active at a checklist stop.
 * Thumbnails open a lightbox when a session URL is available; otherwise a text chip.
 */
export function StopMissionScreenshots({
  refs,
  className,
}: StopMissionScreenshotsProps) {
  const [lightbox, setLightbox] = useState<RowMissionScreenshotRef | null>(
    null,
  );

  if (refs.length === 0) return null;

  return (
    <div
      className={["mt-2", className].filter(Boolean).join(" ")}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        Contract shots
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {refs.map((ref) => {
          const title = `${ref.filename} · ${ref.missionTitles.join(", ")}`;
          if (ref.url) {
            return (
              <li key={ref.logicalPath}>
                <button
                  type="button"
                  title={title}
                  aria-label={`Open screenshot ${ref.filename}`}
                  onClick={() => setLightbox(ref)}
                  className="block overflow-hidden rounded-rsi border border-rsi-border bg-rsi-bg-deep/80 transition-colors hover:border-rsi-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ref.url}
                    alt={ref.filename}
                    loading="lazy"
                    className="h-10 w-10 object-cover object-top sm:h-11 sm:w-11"
                  />
                </button>
              </li>
            );
          }
          return (
            <li key={ref.logicalPath}>
              <span
                title={title}
                className="inline-flex max-w-[10rem] truncate rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 px-1.5 py-1 font-mono text-[0.55rem] text-rsi-text-secondary"
              >
                {ref.label}
              </span>
            </li>
          );
        })}
      </ul>
      {lightbox?.url ? (
        <ImageLightbox
          src={lightbox.url}
          alt={lightbox.filename}
          title={lightbox.filename}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  );
}
