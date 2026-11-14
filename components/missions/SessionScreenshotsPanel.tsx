"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  deleteSessionScreenshot,
  fetchSessionScreenshots,
  uploadSessionScreenshots,
  type ScreenshotListItem,
} from "@/lib/api/screenshotsApi";
import {
  imageFilesFromClipboardApi,
  imageFilesFromDataTransfer,
  imageFilesFromList,
} from "@/lib/ui/imagePasteFiles";
import { Button } from "@/components/ui/Button";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";

export type SessionScreenshotsPanelProps = {
  open: boolean;
  sessionId: string;
  onClose: () => void;
  /** Storybook / offline seed (skips network). */
  initialScreenshots?: ScreenshotListItem[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Lucide-style clipboard (clearer clip + board silhouette). */
function ClipboardIcon({ className }: { className?: string }) {
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
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </svg>
  );
}

/** Modal: upload + browse contract screenshots for a hauling trip. */
export function SessionScreenshotsPanel({
  open,
  sessionId,
  onClose,
  initialScreenshots,
}: SessionScreenshotsPanelProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const isUploadingRef = useRef(false);
  const [screenshots, setScreenshots] = useState<ScreenshotListItem[]>(
    initialScreenshots ?? [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<ScreenshotListItem | null>(null);

  isUploadingRef.current = isUploading;

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length || isUploadingRef.current) return;
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
    },
    [sessionId, initialScreenshots],
  );

  const pasteFromClipboard = useCallback(
    async (dataTransfer?: DataTransfer | null) => {
      if (isUploadingRef.current) return;
      let images = imageFilesFromDataTransfer(dataTransfer ?? null);
      if (!images.length) {
        try {
          images = await imageFilesFromClipboardApi();
        } catch {
          setError(
            "Clipboard access denied. Allow clipboard permission, or use ⌘V / Ctrl+V.",
          );
          return;
        }
      }
      if (!images.length) {
        setError("Clipboard has no image. Copy a screenshot, then paste.");
        return;
      }
      await uploadFiles(images);
    },
    [uploadFiles],
  );

  useEffect(() => {
    if (!open) {
      setLightbox(null);
      setIsDragging(false);
      dragDepthRef.current = 0;
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !lightbox) onClose();
    };
    const onPaste = (event: globalThis.ClipboardEvent) => {
      if (isUploadingRef.current) return;
      const images = imageFilesFromDataTransfer(event.clipboardData);
      if (!images.length) return;
      event.preventDefault();
      void uploadFiles(images);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("paste", onPaste);
    };
  }, [open, lightbox, onClose, uploadFiles]);

  useEffect(() => {
    if (!open || initialScreenshots) return;
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
  }, [open, sessionId, initialScreenshots]);

  useEffect(() => {
    if (open && initialScreenshots) {
      setScreenshots(initialScreenshots);
    }
  }, [open, initialScreenshots]);

  if (!open) return null;

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
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-rsi-bg-deep/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Trip screenshots"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={[
          "flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden border-rsi-border bg-rsi-surface shadow-rsi-panel sm:h-auto sm:max-h-[90vh] sm:rounded-rsi sm:border",
          isDragging ? "ring-2 ring-[var(--rsi-ring)]" : "",
        ].join(" ")}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <header className="relative border-b border-rsi-divider px-4 py-3 pr-12 sm:px-5 sm:py-4 sm:pr-14">
          <ModalCloseButton
            label="Close screenshots"
            onClick={onClose}
          />
          <div className="min-w-0">
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
              Screenshots
            </p>
            <h2 className="text-base font-semibold tracking-wide text-rsi-text sm:text-lg">
              Contract shots
            </h2>
            <p className="mt-1 text-xs text-rsi-text-muted">
              Paste (⌘V / Ctrl+V), drop, or upload — multiple images at once.
              Pending shots are what MCP AI reads next; processed means already
              parsed into the trip.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="sr-only"
              onChange={(event) => onPickFiles(event.target.files)}
            />
            <button
              type="button"
              disabled={isUploading}
              aria-label="Paste screenshot from clipboard"
              title="Paste from clipboard"
              onClick={() => void pasteFromClipboard()}
              className="inline-flex size-9 items-center justify-center rounded-rsi border border-rsi-border text-rsi-text-secondary transition-colors hover:border-rsi-border-strong hover:text-rsi-accent disabled:opacity-50"
            >
              <ClipboardIcon className="size-4" />
            </button>
            <Button
              variant="secondary"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
              className="!normal-case tracking-wide"
            >
              {isUploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </header>

        <div className="overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
          {error ? (
            <p className="mb-3 text-sm text-rsi-warn">{error}</p>
          ) : null}

          {isDragging ? (
            <p className="mb-3 rounded-rsi border border-dashed border-rsi-accent bg-rsi-accent-muted/40 px-3 py-4 text-center font-mono text-xs uppercase tracking-[0.16em] text-rsi-accent">
              Drop to upload
            </p>
          ) : null}

          {isLoading ? (
            <p className="font-mono text-sm text-rsi-text-muted">Loading…</p>
          ) : screenshots.length === 0 ? (
            <div className="rounded-rsi border border-dashed border-rsi-border bg-rsi-bg-deep/40 px-3 py-8 text-center text-sm text-rsi-text-muted">
              <p>
                No screenshots yet. Paste, use the clipboard button, drop, or
                browse.
              </p>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => inputRef.current?.click()}
                className="mt-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-accent hover:text-rsi-accent-hover disabled:opacity-50"
              >
                Browse files
              </button>
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5">
              {screenshots.map((shot) => {
                const isPending = shot.status !== "processed";
                return (
                <li key={shot.logicalPath} className="group relative">
                  <button
                    type="button"
                    title={`${shot.filename} · ${formatBytes(shot.bytes)} · ${isPending ? "pending" : "processed"} — click to enlarge`}
                    aria-label={`Enlarge ${shot.filename}`}
                    className="block w-full overflow-hidden rounded-rsi border border-rsi-border bg-rsi-bg-deep/80 transition-colors hover:border-rsi-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]"
                    onClick={() => setLightbox(shot)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shot.url}
                      alt={shot.filename}
                      loading="lazy"
                      className={[
                        "aspect-square w-full object-cover object-top",
                        isPending ? "" : "opacity-70",
                      ].join(" ")}
                    />
                  </button>
                  <span
                    className={[
                      "pointer-events-none absolute bottom-1 left-1 rounded-sm px-1 py-0.5 font-mono text-[0.45rem] uppercase tracking-[0.12em] shadow-rsi-panel",
                      isPending
                        ? "bg-rsi-accent/90 text-rsi-bg-deep"
                        : "bg-rsi-bg-deep/85 text-rsi-text-muted",
                    ].join(" ")}
                  >
                    {isPending ? "Pending" : "Done"}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${shot.filename}`}
                    onClick={() => void onDelete(shot)}
                    className="absolute right-1 top-1 rounded-sm bg-rsi-bg-deep/85 px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-danger opacity-0 shadow-rsi-panel transition-opacity hover:text-rsi-accent group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    ×
                  </button>
                </li>
                );
              })}
            </ul>
          )}
        </div>

        {lightbox ? (
          <ImageLightbox
            src={lightbox.url}
            alt={lightbox.filename}
            title={lightbox.filename}
            onClose={() => setLightbox(null)}
          />
        ) : null}
      </div>
    </div>
  );
}
