"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { DragEvent } from "react";
import {
  deleteIntakeFile,
  fetchIntakeUploads,
  markIntakeFileProcessed,
  uploadIntakeFiles,
  type IntakeUploadListItem,
} from "@/lib/api/intakeApi";
import {
  imageFilesFromClipboardApi,
  imageFilesFromDataTransfer,
  imageFilesFromList,
} from "@/lib/ui/imagePasteFiles";
import { Button } from "@/components/ui/Button";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

export type IntakeUploadsViewProps = {
  /** Storybook / offline seed (skips network). */
  initialPending?: IntakeUploadListItem[];
  initialProcessed?: IntakeUploadListItem[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Lucide-style clipboard (same control as contract Sources). */
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

function UploadGrid({
  items,
  emptyLabel,
  onOpen,
  onDelete,
  onMarkProcessed,
}: {
  items: IntakeUploadListItem[];
  emptyLabel: string;
  onOpen: (item: IntakeUploadListItem) => void;
  onDelete?: (item: IntakeUploadListItem) => void;
  onMarkProcessed?: (item: IntakeUploadListItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-rsi border border-dashed border-rsi-border bg-rsi-bg-deep/40 px-3 py-8 text-center text-sm text-rsi-text-muted">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-2.5 md:grid-cols-5">
      {items.map((shot) => (
        <li key={shot.logicalPath} className="group relative">
          <button
            type="button"
            title={`${shot.filename} · ${formatBytes(shot.bytes)} — click to enlarge`}
            aria-label={`Enlarge ${shot.filename}`}
            className="block w-full overflow-hidden rounded-rsi border border-rsi-border bg-rsi-bg-deep/80 transition-colors hover:border-rsi-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]"
            onClick={() => onOpen(shot)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                shot.status === "processed"
                  ? `${shot.url}?status=processed`
                  : shot.url
              }
              alt={shot.filename}
              loading="lazy"
              className="aspect-square w-full object-cover object-top"
            />
          </button>
          <div className="absolute right-1 top-1 flex flex-col items-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {onMarkProcessed ? (
              <button
                type="button"
                aria-label={`Mark ${shot.filename} processed`}
                onClick={() => onMarkProcessed(shot)}
                className="rounded-sm bg-rsi-bg-deep/85 px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-success shadow-rsi-panel hover:text-rsi-accent"
              >
                Done
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                aria-label={`Remove ${shot.filename}`}
                onClick={() => onDelete(shot)}
                className="rounded-sm bg-rsi-bg-deep/85 px-1.5 py-0.5 font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-danger shadow-rsi-panel hover:text-rsi-accent"
              >
                ×
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Site inbox for contract/mission screenshots destined for AI catalog intake.
 * Same paste / drop / upload flow as trip Sources.
 */
export function IntakeUploadsView({
  initialPending,
  initialProcessed,
}: IntakeUploadsViewProps = {}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const isUploadingRef = useRef(false);
  const offline = Boolean(initialPending || initialProcessed);
  const [pending, setPending] = useState<IntakeUploadListItem[]>(
    initialPending ?? [],
  );
  const [processed, setProcessed] = useState<IntakeUploadListItem[]>(
    initialProcessed ?? [],
  );
  const [isLoading, setIsLoading] = useState(!offline);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<IntakeUploadListItem | null>(null);

  isUploadingRef.current = isUploading;

  const refresh = useCallback(async () => {
    if (offline) return;
    const [pendingResult, processedResult] = await Promise.all([
      fetchIntakeUploads("pending"),
      fetchIntakeUploads("processed"),
    ]);
    setPending(pendingResult.uploads);
    setProcessed(processedResult.uploads);
  }, [offline]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length || isUploadingRef.current) return;
      setIsUploading(true);
      setError(null);
      try {
        if (offline) {
          const stamp = Date.now();
          const fake: IntakeUploadListItem[] = files.map((file, index) => ({
            status: "pending",
            logicalPath: `intake-pending/story-${stamp}-${index}-${file.name}`,
            filename: file.name || `paste-${index}.png`,
            bytes: file.size,
            mtime: new Date().toISOString(),
            url: URL.createObjectURL(file),
          }));
          setPending((prev) => [...fake, ...prev]);
        } else {
          await uploadIntakeFiles(files);
          await refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setIsUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [offline, refresh],
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
    const onPaste = (event: globalThis.ClipboardEvent) => {
      if (isUploadingRef.current) return;
      const images = imageFilesFromDataTransfer(event.clipboardData);
      if (!images.length) return;
      event.preventDefault();
      void uploadFiles(images);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [uploadFiles]);

  useEffect(() => {
    if (offline) return;
    let cancelled = false;
    setIsLoading(true);
    void refresh()
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load intake uploads",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offline, refresh]);

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

  const onDelete = async (shot: IntakeUploadListItem) => {
    setError(null);
    try {
      if (!offline) {
        await deleteIntakeFile(shot.filename, shot.status);
        await refresh();
      } else if (shot.status === "pending") {
        setPending((prev) =>
          prev.filter((row) => row.logicalPath !== shot.logicalPath),
        );
      } else {
        setProcessed((prev) =>
          prev.filter((row) => row.logicalPath !== shot.logicalPath),
        );
      }
      if (lightbox?.logicalPath === shot.logicalPath) setLightbox(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const onMarkProcessed = async (shot: IntakeUploadListItem) => {
    setError(null);
    try {
      if (!offline) {
        await markIntakeFileProcessed(shot.filename);
        await refresh();
      } else {
        setPending((prev) =>
          prev.filter((row) => row.logicalPath !== shot.logicalPath),
        );
        setProcessed((prev) => [
          {
            ...shot,
            status: "processed",
            logicalPath: `intake-processed/${shot.filename}`,
          },
          ...prev,
        ]);
      }
      if (lightbox?.logicalPath === shot.logicalPath) setLightbox(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mark processed failed");
    }
  };

  return (
    <div
      className={[
        "flex min-w-0 flex-col gap-6",
        isDragging ? "rounded-rsi ring-2 ring-[var(--rsi-ring)]" : "",
      ].join(" ")}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-rsi-accent">
            Intake
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-wide text-rsi-text sm:text-xl">
            Contract uploads
          </h2>
          <p className="mt-1 max-w-xl text-sm text-rsi-text-secondary">
            Paste (⌘V / Ctrl+V), drop, or upload mission screenshots for AI to
            read into the contracts catalog. Mark Done after processing to move
            them out of the inbox.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      {error ? <p className="text-sm text-rsi-warn">{error}</p> : null}

      {isDragging ? (
        <p className="rounded-rsi border border-dashed border-rsi-accent bg-rsi-accent-muted/40 px-3 py-4 text-center font-mono text-xs uppercase tracking-[0.16em] text-rsi-accent">
          Drop to upload
        </p>
      ) : null}

      {isLoading ? (
        <p className="font-mono text-sm text-rsi-text-muted">Loading…</p>
      ) : (
        <>
          <section className="min-w-0">
            <h3 className="mb-2 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-rsi-text-muted">
              Pending · {pending.length}
            </h3>
            <UploadGrid
              items={pending}
              emptyLabel="No pending shots. Paste, use the clipboard button, drop, or browse."
              onOpen={setLightbox}
              onDelete={(shot) => void onDelete(shot)}
              onMarkProcessed={(shot) => void onMarkProcessed(shot)}
            />
          </section>
          <section className="min-w-0">
            <h3 className="mb-2 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-rsi-text-muted">
              Processed · {processed.length}
            </h3>
            <UploadGrid
              items={processed}
              emptyLabel="Nothing processed yet. After AI intake, mark pending shots Done."
              onOpen={setLightbox}
              onDelete={(shot) => void onDelete(shot)}
            />
          </section>
        </>
      )}

      {lightbox ? (
        <ImageLightbox
          src={
            lightbox.status === "processed"
              ? `${lightbox.url}?status=processed`
              : lightbox.url
          }
          alt={lightbox.filename}
          title={lightbox.filename}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  );
}
