"use client";

import { useMemo, useState } from "react";
import {
  ImageLightbox,
  type ImageLightboxItem,
} from "@/components/ui/ImageLightbox";
import { SourceIcon } from "@/components/ui/SourceIcon";
import type { RowMissionScreenshotRef } from "@/lib/missions/rowMissionScreenshots";

export type StopMissionScreenshotsProps = {
  refs: RowMissionScreenshotRef[];
  className?: string;
  /** Compact control for embedding next to a section label. */
  variant?: "block" | "inline";
};

const sourceBtnClass = [
  "inline-flex size-6 items-center justify-center rounded-rsi border",
  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
].join(" ");

/**
 * Opens a gallery of contract screenshots for missions active at this stop.
 * Icon-only control (same glyph as the missions table source button).
 */
export function StopMissionScreenshots({
  refs,
  className,
  variant = "block",
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
        title: ref.filename,
        caption:
          ref.captions.length > 0
            ? ref.captions.join("\n\n")
            : ref.missionTitles.length > 0
              ? ref.missionTitles.join(", ")
              : undefined,
      }));
  }, [refs]);

  const textOnlyCount = refs.length - galleryItems.length;

  if (refs.length === 0) return null;

  const canOpenGallery = galleryItems.length > 0;

  const control = canOpenGallery ? (
    <button
      type="button"
      title={
        galleryItems.length > 1
          ? `Open ${galleryItems.length} source screenshots for this stop`
          : "Open source screenshot for this stop"
      }
      aria-label="View source"
      onClick={() => {
        setGalleryIndex(0);
        setGalleryOpen(true);
      }}
      className={[
        sourceBtnClass,
        "border-rsi-border bg-rsi-surface text-rsi-text-secondary",
        "hover:border-rsi-accent/50 hover:text-rsi-accent",
      ].join(" ")}
    >
      <SourceIcon />
    </button>
  ) : textOnlyCount > 0 ? (
    <span
      title={refs.map((ref) => ref.label).join(", ")}
      aria-label="No source screenshot available"
      className={[
        sourceBtnClass,
        "cursor-default border-rsi-border/50 text-rsi-text-muted opacity-40",
      ].join(" ")}
    >
      <SourceIcon />
    </span>
  ) : null;

  if (!control) return null;

  return (
    <div
      className={[
        variant === "block" ? "mt-2" : "inline-flex shrink-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {control}

      {galleryOpen && galleryItems.length > 0 ? (
        <ImageLightbox
          src={galleryItems[galleryIndex]?.src ?? galleryItems[0]!.src}
          alt={galleryItems[galleryIndex]?.alt}
          title={galleryItems[galleryIndex]?.title}
          caption={galleryItems[galleryIndex]?.caption}
          items={galleryItems}
          index={galleryIndex}
          onIndexChange={setGalleryIndex}
          onClose={() => setGalleryOpen(false)}
        />
      ) : null}
    </div>
  );
}
