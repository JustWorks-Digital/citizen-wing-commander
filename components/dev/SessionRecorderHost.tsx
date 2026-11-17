"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  emptyUiActionTrace,
  RECORDER_STORAGE_KEY,
  type UiActionTrace,
  type UiTraceAction,
} from "@/lib/recording/uiActionTrace";

export type SessionRecorderHostProps = {
  /** Capability gate already evaluated on the server. */
  enabled: boolean;
};

function locatorFrom(el: Element | null): Pick<
  UiTraceAction,
  "testId" | "role" | "name"
> {
  if (!el || !(el instanceof HTMLElement)) return {};
  const withTestId = el.closest("[data-testid]");
  const testId = withTestId?.getAttribute("data-testid") ?? undefined;
  const name =
    el.getAttribute("aria-label")?.trim() ||
    (el instanceof HTMLInputElement
      ? el.labels?.[0]?.textContent?.trim()
      : undefined) ||
    el.getAttribute("title")?.trim() ||
    el.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ||
    undefined;
  const role = el.getAttribute("role") ?? el.tagName.toLowerCase();
  return { testId: testId || undefined, role, name: name || undefined };
}

function readActive(): boolean {
  try {
    return sessionStorage.getItem(RECORDER_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeActive(active: boolean) {
  try {
    if (active) sessionStorage.setItem(RECORDER_STORAGE_KEY, "1");
    else sessionStorage.removeItem(RECORDER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function sessionIdFromPath(pathname: string): string | null {
  const match = pathname.match(
    /\/sessions\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  return match?.[1]?.toLowerCase() ?? null;
}

/**
 * App-wide UI action recorder overlay. Mount only when capability gate is on.
 * Listeners attach only while the user has started recording.
 * Press `R` to show / hide the box (ignored while typing in a field).
 */
export function SessionRecorderHost({ enabled }: SessionRecorderHostProps) {
  const pathname = usePathname();
  const [recording, setRecording] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [count, setCount] = useState(0);
  const traceRef = useRef<UiActionTrace>(emptyUiActionTrace());

  useEffect(() => {
    if (!enabled) return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("record") === "1";
    const next = fromQuery || readActive();
    setRecording(next);
    if (fromQuery) writeActive(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      return Boolean(
        target.closest(
          "input, textarea, select, [contenteditable='true'], [role='textbox']",
        ),
      );
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.repeat) return;
      if (isTypingTarget(event.target)) return;
      if (event.key.toLowerCase() !== "r") return;
      event.preventDefault();
      setPanelOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !recording) return;
    const push = (action: Omit<UiTraceAction, "ts">) => {
      traceRef.current.actions.push({ ts: Date.now(), ...action });
      setCount(traceRef.current.actions.length);
    };

    push({ type: "navigate", url: window.location.href });

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.("[data-recorder-ui]")) return;
      push({ type: "click", ...locatorFrom(target) });
    };

    const onChange = (event: Event) => {
      const target = event.target as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null;
      if (!target || !("value" in target)) return;
      if (target.closest?.("[data-recorder-ui]")) return;
      push({
        type: "fill",
        ...locatorFrom(target),
        value: String(target.value),
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== "Escape") return;
      const target = event.target as Element | null;
      if (target?.closest?.("[data-recorder-ui]")) return;
      push({
        type: "keydown",
        ...locatorFrom(target),
        value: event.key,
      });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onChange, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [enabled, recording]);

  useEffect(() => {
    if (!enabled || !recording) return;
    traceRef.current.actions.push({
      ts: Date.now(),
      type: "navigate",
      url: window.location.href,
    });
    traceRef.current.sessionId = sessionIdFromPath(pathname);
    setCount(traceRef.current.actions.length);
  }, [enabled, recording, pathname]);

  if (!enabled || !panelOpen) return null;

  const start = () => {
    traceRef.current = emptyUiActionTrace({
      sessionId: sessionIdFromPath(pathname),
    });
    setCount(0);
    writeActive(true);
    setRecording(true);
  };

  const stop = () => {
    writeActive(false);
    setRecording(false);
  };

  const clear = () => {
    traceRef.current = emptyUiActionTrace({
      sessionId: sessionIdFromPath(pathname),
    });
    setCount(0);
  };

  const exportTrace = async () => {
    const payload = {
      ...traceRef.current,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      sessionId:
        traceRef.current.sessionId ?? sessionIdFromPath(pathname),
    };
    const text = `${JSON.stringify(payload, null, 2)}\n`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fall through to download
    }
    const blob = new Blob([text], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `trace-${payload.sessionId ?? "app"}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  return (
    <div
      data-recorder-ui
      data-testid="session-recorder"
      className="fixed bottom-3 right-3 z-[100] flex max-w-[16rem] flex-col gap-2 rounded-rsi border border-rsi-border bg-rsi-surface px-3 py-2 shadow-rsi-panel"
    >
      <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        Recorder · {recording ? "on" : "off"} · {count}
      </p>
      <div className="flex flex-wrap gap-2">
        {recording ? (
          <button
            type="button"
            className="font-mono text-[0.65rem] uppercase tracking-wide text-rsi-danger hover:underline"
            onClick={stop}
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="font-mono text-[0.65rem] uppercase tracking-wide text-rsi-accent hover:underline"
            onClick={start}
          >
            Record
          </button>
        )}
        <button
          type="button"
          className="font-mono text-[0.65rem] uppercase tracking-wide text-rsi-text-secondary hover:underline"
          onClick={clear}
          disabled={count === 0}
        >
          Clear
        </button>
        <button
          type="button"
          className="font-mono text-[0.65rem] uppercase tracking-wide text-rsi-text-secondary hover:underline"
          onClick={() => {
            void exportTrace();
          }}
          disabled={count === 0}
        >
          Export
        </button>
      </div>
    </div>
  );
}
