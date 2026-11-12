"use client";

import { useEffect, useId, useRef, useState } from "react";

export type SessionNameFieldProps = {
  name: string;
  onRename: (nextName: string) => void;
  disabled?: boolean;
  className?: string;
};

/** Session title with inline rename (edit control + click-to-edit). */
export function SessionNameField({
  name,
  onRename,
  disabled = false,
  className,
}: SessionNameFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    if (!isEditing) setDraft(name);
  }, [name, isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const node = inputRef.current;
    if (!node) return;
    node.focus();
    node.select();
  }, [isEditing]);

  const commit = () => {
    const next = draft.trim();
    setIsEditing(false);
    if (!next || next === name) {
      setDraft(name);
      return;
    }
    onRename(next);
  };

  const cancel = () => {
    setDraft(name);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className={["min-w-0", className].filter(Boolean).join(" ")}>
        <label htmlFor={inputId} className="sr-only">
          Trip name
        </label>
        <input
          ref={inputRef}
          id={inputId}
          value={draft}
          disabled={disabled}
          maxLength={120}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          className={[
            "w-full min-w-0 rounded-rsi border border-rsi-accent/50 bg-rsi-bg-deep px-2.5 py-1.5",
            "text-lg font-semibold tracking-wide text-rsi-text sm:text-xl",
            "outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
            "disabled:opacity-60",
          ].join(" ")}
        />
      </div>
    );
  }

  return (
    <div
      className={[
        "group flex min-w-0 items-start gap-2",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        disabled={disabled}
        title="Rename trip"
        aria-label={`Rename trip ${name}`}
        onClick={() => {
          if (disabled) return;
          setDraft(name);
          setIsEditing(true);
        }}
        className={[
          "min-w-0 flex-1 text-left text-lg font-semibold tracking-wide break-words text-rsi-text sm:text-xl",
          "rounded-sm transition-colors hover:text-rsi-accent",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
          "disabled:cursor-default disabled:hover:text-rsi-text",
        ].join(" ")}
      >
        {name}
      </button>
      <button
        type="button"
        disabled={disabled}
        title="Rename trip"
        aria-label="Edit trip name"
        onClick={() => {
          if (disabled) return;
          setDraft(name);
          setIsEditing(true);
        }}
        className={[
          "mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-rsi border border-rsi-border",
          "bg-rsi-surface text-rsi-text-secondary transition-opacity",
          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100",
          "hover:border-rsi-accent/50 hover:text-rsi-accent",
          "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
          "disabled:opacity-40",
        ].join(" ")}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
    </div>
  );
}
