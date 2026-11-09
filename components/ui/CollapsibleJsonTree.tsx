"use client";

import { useState } from "react";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type CollapsibleJsonTreeProps = {
  value: JsonValue;
};

function isPlainObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function previewLabel(value: JsonValue): string {
  if (Array.isArray(value)) {
    const n = value.length;
    return n === 0 ? "[]" : `[${n}]`;
  }
  if (isPlainObject(value)) {
    const n = Object.keys(value).length;
    return n === 0 ? "{}" : `{${n}}`;
  }
  return "";
}

function JsonPrimitive({ value }: { value: string | number | boolean | null }) {
  if (value === null) {
    return <span className="text-rsi-warn">null</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-rsi-warn">{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className="text-rsi-warn">{value}</span>;
  }
  return <span className="text-rsi-success">{JSON.stringify(value)}</span>;
}

function JsonKey({ name }: { name: string }) {
  return <span className="text-rsi-accent">{JSON.stringify(name)}</span>;
}

type NodeProps = {
  name?: string;
  value: JsonValue;
  path: string;
  isLast: boolean;
};

function CollapsibleJsonNode({ name, value, path, isLast }: NodeProps) {
  const isArray = Array.isArray(value);
  const isObject = isPlainObject(value);
  const isBranch = isArray || isObject;
  const [isOpen, setIsOpen] = useState(false);
  const comma = isLast ? null : (
    <span className="text-rsi-text-muted">,</span>
  );

  if (!isBranch) {
    return (
      <div className="relative flex flex-wrap items-baseline gap-x-1 pl-4">
        {name !== undefined ? (
          <>
            <JsonKey name={name} />
            <span className="text-rsi-text-muted">:</span>
          </>
        ) : null}
        <JsonPrimitive value={value as string | number | boolean | null} />
        {comma}
      </div>
    );
  }

  const entries = isArray
    ? value.map((entry, index) => ({ key: String(index), child: entry }))
    : Object.entries(value).map(([key, child]) => ({ key, child }));
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";

  return (
    <div>
      <div className="relative flex flex-wrap items-baseline gap-x-1 pl-4">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-label={
            isOpen ? `Collapse ${name ?? "value"}` : `Expand ${name ?? "value"}`
          }
          onClick={() => setIsOpen((open) => !open)}
          className={[
            "absolute top-0.5 left-0 inline-flex size-4 shrink-0 items-center justify-center rounded-sm",
            "text-rsi-text-muted transition-colors hover:text-rsi-accent",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--rsi-ring)]",
            "focus-visible:ring-inset active:scale-100",
          ].join(" ")}
        >
          <span
            aria-hidden
            className={[
              "inline-block size-2.5 font-mono text-[0.55rem] leading-none",
              "origin-center transition-transform",
              isOpen ? "rotate-90" : "rotate-0",
            ].join(" ")}
          >
            ▶
          </span>
        </button>
        {name !== undefined ? (
          <>
            <JsonKey name={name} />
            <span className="text-rsi-text-muted">:</span>
          </>
        ) : null}
        {!isOpen ? (
          <>
            <span className="text-rsi-text-muted">{previewLabel(value)}</span>
            {comma}
          </>
        ) : (
          <span className="text-rsi-text-muted">{openBracket}</span>
        )}
      </div>
      {isOpen ? (
        <>
          <div className="ml-4 border-l border-rsi-border/60 pl-3">
            {entries.map((entry, index) => (
              <CollapsibleJsonNode
                key={`${path}.${entry.key}`}
                name={isArray ? undefined : entry.key}
                value={entry.child}
                path={`${path}.${entry.key}`}
                isLast={index === entries.length - 1}
              />
            ))}
          </div>
          <div className="pl-4">
            <span className="text-rsi-text-muted">{closeBracket}</span>
            {comma}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Interactive JSON tree; root object keys are always shown (not collapsible). */
export function CollapsibleJsonTree({ value }: CollapsibleJsonTreeProps) {
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    return (
      <div className="font-mono text-[0.75rem] leading-relaxed">
        {entries.map(([key, child], index) => (
          <CollapsibleJsonNode
            key={`$.${key}`}
            name={key}
            value={child}
            path={`$.${key}`}
            isLast={index === entries.length - 1}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="font-mono text-[0.75rem] leading-relaxed">
      <CollapsibleJsonNode value={value} path="$" isLast />
    </div>
  );
}

/** Best-effort cast for API / DB JSON blobs. */
export function asJsonValue(value: unknown): JsonValue {
  return value as JsonValue;
}
