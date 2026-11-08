"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ClipboardEvent, DragEvent } from "react";
import {
  deleteSessionScreenshot,
  fetchSessionScreenshots,
  uploadSessionScreenshots,
  type ScreenshotListItem,
} from "@/lib/api/screenshotsApi";
import { Button } from "@/components/ui/Button";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

export type SessionScreenshotsPanelProps = {
  sessionId: string;
  /** Storybook / offline seed (skips network). */
  initialScreenshots?: ScreenshotListItem[];
};

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function imageFilesFromList(list: FileList | File[] | null): File[] {
  if (!list) return [];
  return Array.from(list).filter(
    (file) =>
      IMAGE_TYPES.has(file.type.toLowerCase()) ||
      /\.(png|jpe?g|webp|gif)$/i.test(file.name),
  );
}

function imageFilesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fromItems: File[] = [];
  const seen = new Set<string>();

  for (const item of Array.from(data.items)) {
    if (item.kind !== "file") continue;
    const type = item.type.toLowerCase();
    if (!IMAGE_TYPES.has(type)) continue;
    const file = item.getAsFile();
    if (!file || file.size === 0) continue;
    const fingerprint = `${file.size}:${type}:${file.name}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    const ext = EXT_BY_MIME[type] ?? ".png";
    const index = fromItems.length + 1;
    const name =
      file.name && file.name !== "image.png"
        ? file.name
        : `paste-${stamp}-${index}${ext}`;
    fromItems.push(
      new File([file], name, {
        type: file.type || type,
        lastModified: file.lastModified,
      }),
    );
  }

  if (fromItems.length) return fromItems;

  return imageFilesFromList(data.files).map((file, index) => {
    const type = file.type.toLowerCase() || "image/png";
    const ext = EXT_BY_MIME[type] ?? pathExt(file.name) ?? ".png";
    const name =
      file.name && file.name !== "image.png"
        ? file.name
        : `paste-${stamp}-${index + 1}${ext}`;
    return new File([file], name, {
      type: file.type || type,
      lastModified: file.lastModified,
    });
  });
}

function pathExt(name: string): string | null {
  const match = /\.(png|jpe?g|webp|gif)$/i.exec(name);
  return match ? `.${match[1]!.toLowerCase().replace("jpeg", "jpg")}` : null;
}

/** Upload + browse contract screenshots for a hauling session. */
export function SessionScreenshotsPanel({
  sessionId,
  initialScreenshots,
}: SessionScreenshotsPanelProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dragDepthRef = useRef(0);
  const [screenshots, setScreenshots] = useState<ScreenshotListItem[]>(
    initialScreenshots ?? [],
  );
  const [isLoading, setIsLoading] = useState(!initialScreenshots);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPasteReady, setIsPasteReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<ScreenshotListItem | null>(null);

  useEffect(() => {
    if (initialScreenshots) return;
    let cancelled = false;
    setIsLoading(true);
    void fetchSessionScreenshots(sessionId)
      .then((result) => {
        if (!cancelled) {
          setScreenshots(result.screenshots);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load screenshots",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, initialScreenshots]);

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setIsUploading(true);
    setError(null);
    try {
      await uploadSessionScreenshots(sessionId, files);
      if (!initialScreenshots) {
        const result = await fetchSessionScreenshots(sessionId);
        setScreenshots(result.screenshots);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onPickFiles = (files: FileList | null) => {
    void uploadFiles(imageFilesFromList(files));
  };

  const onDragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    if (event.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const onDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  };

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (isUploading) return;
    const images = imageFilesFromList(event.dataTransfer.files);
    if (!images.length) {
      setError("Drop PNG, JPG, WebP, or GIF images.");
      return;
    }
    void uploadFiles(images);
  };

  const onPaste = (event: ClipboardEvent<HTMLElement>) => {
    if (isUploading) return;
    const images = imageFilesFromClipboard(event.clipboardData);
    if (!images.length) {
      setError("Clipboard has no image. Copy a screenshot, then paste here.");
      return;
    }
    event.preventDefault();
    void uploadFiles(images);
  };

  const focusPanelForPaste = () => {
    panelRef.current?.focus();
  };

  const onDelete = async (shot: ScreenshotListItem) => {
    setError(null);
    try {
      await deleteSessionScreenshot(sessionId, shot.filename);
      setScreenshots((prev) =>
        prev.filter((row) => row.filename !== shot.filename),
      );
      if (lightbox?.filename === shot.filename) setLightbox(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <section
      ref={panelRef}
      tabIndex={0}
      aria-label="Session screenshots. Click to focus, then paste an image from the clipboard."
      className={[
        "rounded-rsi border bg-rsi-surface/90 p-4 shadow-rsi-panel transition-colors outline-none",
        isDragging || isPasteReady
          ? "border-rsi-accent bg-rsi-accent-muted/30"
          : "border-rsi-border",
        "focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-rsi-bg",
      ].join(" ")}
      onClick={focusPanelForPaste}
      onFocus={() => setIsPasteReady(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsPasteReady(false);
        }
      }}
      onPaste={onPaste}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-rsi-accent">
            Screenshots
          </p>
          <p className="mt-1 text-xs text-rsi-text-muted">
            Click this panel, then paste, drop, or upload — multiple images at
            once are supported.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="sr-only"
            onChange={(event) => onPickFiles(event.target.files)}
          />
          <Button
            variant="secondary"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
            className="!normal-case tracking-wide"
          >
            {isUploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mb-3 text-sm text-rsi-warn">{error}</p>
      ) : null}

      {isDragging ? (
        <p className="mb-3 rounded-rsi border border-dashed border-rsi-accent bg-rsi-accent-muted/40 px-3 py-4 text-center font-mono text-xs uppercase tracking-[0.16em] text-rsi-accent">
          Drop to upload
        </p>
      ) : isPasteReady ? (
        <p className="mb-3 rounded-rsi border border-dashed border-rsi-accent/60 bg-rsi-accent-muted/25 px-3 py-3 text-center font-mono text-xs uppercase tracking-[0.16em] text-rsi-accent">
          Ready — paste screenshot
        </p>
      ) : null}

      {isLoading ? (
        <p className="font-mono text-sm text-rsi-text-muted">Loading…</p>
      ) : screenshots.length === 0 ? (
        <div className="rounded-rsi border border-dashed border-rsi-border bg-rsi-bg-deep/40 px-3 py-8 text-center text-sm text-rsi-text-muted">
          <p>No screenshots yet. Paste, drop, or browse to add contract shots.</p>
          <button
            type="button"
            disabled={isUploading}
            onClick={(event) => {
              event.stopPropagation();
              inputRef.current?.click();
            }}
            className="mt-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-accent hover:text-rsi-accent-hover disabled:opacity-50"
          >
            Browse files
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
          {screenshots.map((shot) => (
            <li
              key={shot.logicalPath}
              className="overflow-hidden rounded-rsi border border-rsi-border bg-rsi-bg-deep/50"
            >
              <button
                type="button"
                className="block w-full bg-rsi-bg-deep/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]"
                onClick={() => setLightbox(shot)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.url}
                  alt={shot.filename}
                  className="aspect-video w-full object-cover object-top"
                />
              </button>
              <div className="flex items-start justify-between gap-2 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[0.65rem] text-rsi-text">
                    {shot.filename}
                  </p>
                  <p className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
                    {formatBytes(shot.bytes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onDelete(shot)}
                  className="shrink-0 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-danger hover:text-rsi-accent"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {lightbox ? (
        <ImageLightbox
          src={lightbox.url}
          alt={lightbox.filename}
          title={lightbox.filename}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </section>
  );
}
