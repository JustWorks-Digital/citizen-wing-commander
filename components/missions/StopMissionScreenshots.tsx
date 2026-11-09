"use client";

import { useMemo, useState } from "react";
import {
  ImageLightbox,
  type ImageLightboxItem,
} from "@/components/ui/ImageLightbox";
import type { RowMissionScreenshotRef } from "@/lib/missions/rowMissionScreenshots";

export type StopMissionScreenshotsProps = {
  refs: RowMissionScreenshotRef[];
  className?: string;
};

/**
 * Opens a gallery of contract screenshots for missions active at this stop.
 * One “Contract source” control — not a thumbnail strip.
 */
export function StopMissionScreenshots({
  refs,
  className,
}: StopMissionScreenshotsProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const galleryItems = useMemo((): ImageLightboxItem[] => {
    return refs
      .filter((ref): ref is RowMissionScreenshotRef & { url: string } =>
        Boolean(ref.url),
      )
      .map((ref) => ({
        src: ref.url,
        alt: ref.filename,
        title:
          ref.missionTitles.length > 0
            ? `${ref.missionTitles.join(", ")} · ${ref.filename}`
            : ref.filename,
      }));
  }, [refs]);

  const textOnlyCount = refs.length - galleryItems.length;

  if (refs.length === 0) return null;

  const canOpenGallery = galleryItems.length > 0;

  return (
    <div
      className={["mt-2", className].filter(Boolean).join(" ")}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {canOpenGallery ? (
        <button
          type="button"
          title={
            galleryItems.length > 1
              ? `Open ${galleryItems.length} contract screenshots for this stop`
              : "Open contract screenshot for this stop"
          }
          aria-label="Contract source"
          onClick={() => {
            setGalleryIndex(0);
            setGalleryOpen(true);
          }}
          className={[
            "rounded-rsi border border-rsi-border bg-rsi-surface px-2.5 py-1.5",
            "font-mono text-[0.6rem] uppercase tracking-[0.16em] text-rsi-text-secondary",
            "transition-colors hover:border-rsi-accent/50 hover:text-rsi-accent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
          ].join(" ")}
        >
          Contract source
        </button>
      ) : textOnlyCount > 0 ? (
        <p
          className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted"
          title={refs.map((ref) => ref.label).join(", ")}
        >
          Contract source
        </p>
      ) : null}

      {galleryOpen && galleryItems.length > 0 ? (
        <ImageLightbox
          src={galleryItems[galleryIndex]?.src ?? galleryItems[0]!.src}
          alt={galleryItems[galleryIndex]?.alt}
          title={galleryItems[galleryIndex]?.title}
          items={galleryItems}
          index={galleryIndex}
          onIndexChange={setGalleryIndex}
          onClose={() => setGalleryOpen(false)}
        />
      ) : null}
    </div>
  );
}
