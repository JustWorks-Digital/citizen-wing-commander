"use client";

import { useEffect, type ReactNode } from "react";
import { appApi } from "@/lib/api/appRoutes";
import { postPerfSamples } from "@/lib/api/perfApi";
import {
  reportPerfMemory,
  subscribePerfMarks,
} from "@/lib/perf/clientMarks";
import type { PerfSample } from "@/lib/perf/types";

const FLUSH_MS = 2500;
const BATCH_MAX = 30;

function isAppApiUrl(input: RequestInfo | URL): boolean {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  try {
    const path = raw.startsWith("http")
      ? new URL(raw).pathname
      : raw.split("?")[0] ?? raw;
    if (path === appApi.devPerf || path.startsWith(`${appApi.devPerf}/`)) {
      return false;
    }
    return path.startsWith("/api/");
  } catch {
    return false;
  }
}

/**
 * Continuous local perf capture: times `/api/*` fetch, Web Vitals, heap samples,
 * and `reportPerfMark` UI events. Dev-only (mounted from root layout in development).
 */
export function PerfCaptureProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const queue: PerfSample[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const flush = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (queue.length === 0 || cancelled) return;
      const batch = queue.splice(0, BATCH_MAX);
      void postPerfSamples(batch);
      if (queue.length > 0) schedule();
    };

    const schedule = () => {
      if (timer || cancelled) return;
      timer = setTimeout(flush, FLUSH_MS);
    };

    const enqueue = (sample: PerfSample) => {
      queue.push(sample);
      if (queue.length >= BATCH_MAX) flush();
      else schedule();
    };

    const unsubMarks = subscribePerfMarks(enqueue);

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (!isAppApiUrl(input)) {
        return originalFetch(input, init);
      }
      const raw =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const path = raw.startsWith("http")
        ? new URL(raw).pathname
        : (raw.split("?")[0] ?? raw);
      const method = (init?.method ?? "GET").toUpperCase();
      const started = performance.now();
      try {
        const res = await originalFetch(input, init);
        enqueue({
          at: new Date().toISOString(),
          kind: "api",
          name: path,
          value: Math.round((performance.now() - started) * 1000) / 1000,
          unit: "ms",
          tags: {
            method,
            status: res.status,
            source: "client",
          },
        });
        return res;
      } catch (error) {
        enqueue({
          at: new Date().toISOString(),
          kind: "api",
          name: path,
          value: Math.round((performance.now() - started) * 1000) / 1000,
          unit: "ms",
          tags: { method, source: "client", error: true },
        });
        throw error;
      }
    };

    const vitalObserver =
      typeof PerformanceObserver !== "undefined"
        ? new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const name = entry.name || entry.entryType;
              const value =
                "value" in entry && typeof entry.value === "number"
                  ? entry.value
                  : entry.duration;
              if (typeof value !== "number" || !Number.isFinite(value)) continue;
              enqueue({
                at: new Date().toISOString(),
                kind: "vital",
                name: String(name),
                value: Math.round(value * 1000) / 1000,
                unit: "ms",
                tags: { entryType: entry.entryType },
              });
            }
          })
        : null;

    try {
      vitalObserver?.observe({
        type: "largest-contentful-paint",
        buffered: true,
      } as PerformanceObserverInit);
    } catch {
      /* unsupported */
    }
    try {
      vitalObserver?.observe({
        type: "event",
        buffered: true,
        durationThreshold: 16,
      } as PerformanceObserverInit);
    } catch {
      /* INP-ish event timing may be unsupported */
    }
    reportPerfMemory("heap.session-start");
    const heapTimer = window.setInterval(() => {
      reportPerfMemory("heap.periodic");
    }, 60_000);

    const onNav = () => {
      const nav = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return;
      enqueue({
        at: new Date().toISOString(),
        kind: "vital",
        name: "navigation.domContentLoaded",
        value: Math.round(nav.domContentLoadedEventEnd * 1000) / 1000,
        unit: "ms",
      });
      enqueue({
        at: new Date().toISOString(),
        kind: "vital",
        name: "navigation.loadEventEnd",
        value: Math.round(nav.loadEventEnd * 1000) / 1000,
        unit: "ms",
      });
    };
    if (document.readyState === "complete") onNav();
    else window.addEventListener("load", onNav, { once: true });

    return () => {
      cancelled = true;
      unsubMarks();
      vitalObserver?.disconnect();
      window.clearInterval(heapTimer);
      window.fetch = originalFetch;
      if (timer) clearTimeout(timer);
      flush();
    };
  }, []);

  return children;
}
