"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

export type EditableZoomPercentProps = {
  /** Zoom multiplier (1 = 100%). */
  zoom: number;
  min: number;
  max: number;
  /** Called with a clamped multiplier after a typed percent is committed. */
  onChange: (zoom: number) => void;
  /** Single-click action (reset / fit). Suppressed when entering edit. */
  onClick?: () => void;
  className?: string;
  title?: string;
  "aria-label"?: string;
};

function clampZoom(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

function zoomToPercentLabel(zoom: number): string {
  return `${Math.round(zoom * 100)}`;
}

function parsePercentInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/%/g, "");
  if (!trimmed) return null;
  const percent = Number.parseFloat(trimmed);
  if (!Number.isFinite(percent)) return null;
  return percent / 100;
}

/**
 * Shows zoom as a percent. Single-click runs `onClick` (reset/fit);
 * double-click opens an input to type a custom percent.
 */
export function EditableZoomPercent({
  zoom,
  min,
  max,
  onChange,
  onClick,
  className = "",
  title = "Double-click to set zoom",
  "aria-label": ariaLabel = "Zoom percent",
}: EditableZoomPercentProps) {
  const inputId = useId();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(() => zoomToPercentLabel(zoom));
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isEditing) setDraft(zoomToPercentLabel(zoom));
  }, [zoom, isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [isEditing]);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current != null) {
        window.clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  function beginEdit() {
    if (clickTimerRef.current != null) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    setDraft(zoomToPercentLabel(zoom));
    setIsEditing(true);
  }

  function commitEdit() {
    const parsed = parsePercentInput(draft);
    setIsEditing(false);
    if (parsed == null) {
      setDraft(zoomToPercentLabel(zoom));
      return;
    }
    onChange(clampZoom(parsed, min, max));
  }

  function cancelEdit() {
    setIsEditing(false);
    setDraft(zoomToPercentLabel(zoom));
  }

  function handleButtonClick(event: MouseEvent<HTMLButtonElement>) {
    // Second click of a double-click — wait for dblclick instead of resetting.
    if (event.detail > 1) return;
    if (!onClick) return;
    if (clickTimerRef.current != null) {
      window.clearTimeout(clickTimerRef.current);
    }
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      onClick();
    }, 250);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  }

  if (isEditing) {
    return (
      <label
        htmlFor={inputId}
        className={[
          "inline-flex min-w-[2.75rem] items-center justify-center gap-0.5 px-1",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="sr-only">{ariaLabel}</span>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="decimal"
          aria-label={ariaLabel}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-[2.25rem] border-0 bg-transparent p-0 text-center font-mono text-[inherit] tabular-nums text-rsi-accent outline-none"
        />
        <span aria-hidden className="font-mono text-[inherit] text-rsi-text-muted">
          %
        </span>
      </label>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      onClick={handleButtonClick}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        beginEdit();
      }}
      className={className}
    >
      {zoomToPercentLabel(zoom)}%
    </button>
  );
}
