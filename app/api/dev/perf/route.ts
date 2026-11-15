import { NextResponse } from "next/server";
import { isPerfCaptureEnabled } from "@/lib/perf/capture";
import {
  flushPerfSession,
  getPerfHistory,
  getPerfHistoryIndex,
  getPerfRun,
} from "@/lib/perf/historyStore";
import {
  appendPerfSamples,
  clearSessionBuffer,
  summarizeSession,
} from "@/lib/perf/sessionStore";
import type { PerfSample } from "@/lib/perf/types";

function forbid(): NextResponse {
  return NextResponse.json(
    { error: "Perf capture is only available in local development." },
    { status: 403 },
  );
}

/** Live session + git history for /dev/perf. */
export async function GET(request: Request) {
  if (!isPerfCaptureEnabled()) return forbid();

  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");
  if (runId) {
    const run = getPerfRun(runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    return NextResponse.json({ run });
  }

  const live = summarizeSession();
  return NextResponse.json({
    live: {
      meta: live.meta,
      metrics: live.metrics,
      recentSamples: live.recentSamples,
    },
    history: getPerfHistoryIndex(),
    /** Enough points for trend charts (newest-first from index). */
    runs: getPerfHistory().slice(0, 80),
  });
}

type PostBody =
  | { action: "samples"; samples: PerfSample[] }
  | { action: "flush"; clear?: boolean }
  | { action: "clear" };

/** Accept client samples or flush/clear the session buffer. */
export async function POST(request: Request) {
  if (!isPerfCaptureEnabled()) return forbid();

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "samples") {
    const samples = Array.isArray(body.samples) ? body.samples : [];
    const cleaned = samples.filter(
      (s) =>
        s &&
        typeof s.name === "string" &&
        typeof s.value === "number" &&
        typeof s.kind === "string",
    );
    const { meta, shouldAutoFlush } = appendPerfSamples(
      cleaned.map((s) => ({
        ...s,
        at: typeof s.at === "string" ? s.at : new Date().toISOString(),
        unit: s.unit ?? (s.kind === "memory" ? "bytes" : "ms"),
      })),
    );
    let autoFlushedId: string | null = null;
    if (shouldAutoFlush) {
      const { run } = flushPerfSession("session-flush");
      autoFlushedId = run?.id ?? null;
    }
    return NextResponse.json({ ok: true, meta, autoFlushedId });
  }

  if (body.action === "flush") {
    const { run, reason } = flushPerfSession("manual");
    if (!run) {
      return NextResponse.json({ ok: false, reason }, { status: 400 });
    }
    if (body.clear) clearSessionBuffer();
    return NextResponse.json({
      ok: true,
      run,
      hint: `Commit perf/history/${run.id}.json and perf/history/index.json when you want this milestone in git.`,
    });
  }

  if (body.action === "clear") {
    clearSessionBuffer();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
