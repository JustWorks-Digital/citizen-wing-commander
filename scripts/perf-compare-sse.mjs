/**
 * Protocol-level poll vs SSE compare against a running next dev (localhost).
 * Writes perf/baselines/sse-vs-poll.json and prints a summary.
 *
 * Usage: npm run perf:compare-sse
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.APP_ORIGIN || "http://localhost:3000";
const IDLE_MS = Number(process.env.PERF_COMPARE_IDLE_MS || 12_000);
const ACTIVE_MS = Number(process.env.PERF_COMPARE_ACTIVE_MS || 10_000);
const PUT_COUNT = Number(process.env.PERF_COMPARE_PUTS || 8);
const POLL_MS = 1500;
/** Mimic two trip pages open (writer + observer), matching UI poll fan-out. */
const OBSERVERS = Number(process.env.PERF_COMPARE_OBSERVERS || 2);

const baselinesDir = path.join(root, "perf", "baselines");
const pollBaselinePath = path.join(baselinesDir, "poll-pre-sse.json");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function listSessions() {
  const res = await fetch(`${baseUrl}/api/checklist/sessions`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`sessions ${res.status}`);
  return res.json();
}

async function getChecklist(sessionId, etag) {
  const headers = {};
  if (etag) headers["If-None-Match"] = etag;
  const t0 = performance.now();
  const res = await fetch(
    `${baseUrl}/api/checklist?sessionId=${encodeURIComponent(sessionId)}`,
    { cache: "no-store", headers },
  );
  const ms = performance.now() - t0;
  const nextEtag = res.headers.get("ETag");
  if (res.status === 304) {
    return { notModified: true, etag: nextEtag ?? etag, ms, session: null };
  }
  if (!res.ok) throw new Error(`checklist get ${res.status}`);
  return {
    notModified: false,
    etag: nextEtag,
    ms,
    session: await res.json(),
  };
}

async function putChecklist(session) {
  const t0 = performance.now();
  const res = await fetch(
    `${baseUrl}/api/checklist?sessionId=${encodeURIComponent(session.id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
    },
  );
  const ms = performance.now() - t0;
  if (!res.ok) throw new Error(`checklist put ${res.status}`);
  return { session: await res.json(), ms };
}

async function bumpSession(sessionId) {
  const got = await getChecklist(sessionId, null);
  const session = got.session;
  if (!session) throw new Error("missing session body");
  // Touch updatedAt path without changing trip shape: flip finishFeedback noop or name trim.
  const next = {
    ...session,
    sessionName: session.sessionName.replace(/\s+$/, "") + (session.sessionName.endsWith(" ") ? "" : ""),
    // Force a real write: toggle a stable meta via completedAt leave + sessionName space
    // Prefer mutating a harmless field — append/remove zero-width marker in sessionName trail.
    updatedAt: new Date().toISOString(),
  };
  // Ensure body differs: flip hide-safe missionsCompleted unchanged; bump via notes on first row distance null keep
  next.sessionName = session.sessionName.endsWith("\u200b")
    ? session.sessionName.slice(0, -1)
    : `${session.sessionName}\u200b`;
  return putChecklist(next);
}

async function fetchSessions() {
  const t0 = performance.now();
  const res = await fetch(`${baseUrl}/api/checklist/sessions`, {
    cache: "no-store",
  });
  const ms = performance.now() - t0;
  if (!res.ok) throw new Error(`sessions ${res.status}`);
  await res.json();
  return ms;
}

async function runPollMode(sessionId) {
  let gets = 0;
  let getMs = [];
  let sessionsGets = 0;
  let sessionsMs = [];
  let idleGets = 0;
  let puts = 0;
  let putMs = [];
  const idleEnd = Date.now() + IDLE_MS;
  const endAt = idleEnd + ACTIVE_MS;

  const poller = async () => {
    let etag = null;
    while (Date.now() < endAt) {
      const inIdle = Date.now() < idleEnd;
      // Match SessionChecklistView load(): tabs list + checklist every tick.
      const tabMs = await fetchSessions();
      sessionsGets += 1;
      sessionsMs.push(tabMs);
      const result = await getChecklist(sessionId, etag);
      gets += 1;
      getMs.push(result.ms);
      if (inIdle) idleGets += 1;
      if (result.etag) etag = result.etag;
      await sleep(POLL_MS);
    }
  };

  const writer = (async () => {
    await sleep(IDLE_MS + 200);
    for (let i = 0; i < PUT_COUNT; i++) {
      if (Date.now() >= endAt) break;
      const { ms } = await bumpSession(sessionId);
      puts += 1;
      putMs.push(ms);
      await sleep(Math.floor(ACTIVE_MS / PUT_COUNT));
    }
  })();

  await Promise.all([
    ...Array.from({ length: OBSERVERS }, () => poller()),
    writer,
  ]);
  return summarize("poll", {
    gets,
    getMs,
    puts,
    putMs,
    syncLags: [],
    sessionsGets,
    sessionsMs,
    idleGets,
  });
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const w = rank - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function summarize(
  mode,
  {
    gets,
    getMs,
    puts,
    putMs,
    syncLags,
    events = 0,
    sessionsGets = 0,
    sessionsMs = [],
    idleGets = 0,
  },
) {
  const sortedGet = [...getMs].sort((a, b) => a - b);
  const sortedPut = [...putMs].sort((a, b) => a - b);
  const sortedLag = [...syncLags].sort((a, b) => a - b);
  const sortedSessions = [...sessionsMs].sort((a, b) => a - b);
  return {
    mode,
    idleMs: IDLE_MS,
    activeMs: ACTIVE_MS,
    observers: OBSERVERS,
    checklistGetCount: gets,
    checklistGetIdleCount: idleGets,
    checklistSessionsGetCount: sessionsGets,
    checklistPutCount: puts,
    checklistGetsPerPut: puts > 0 ? gets / puts : null,
    sessionsGetsPerPut: puts > 0 ? sessionsGets / puts : null,
    sseEventCount: events,
    checklistGetP50Ms: percentile(sortedGet, 50),
    checklistGetP95Ms: percentile(sortedGet, 95),
    checklistSessionsGetP50Ms: percentile(sortedSessions, 50),
    checklistSessionsGetP95Ms: percentile(sortedSessions, 95),
    checklistPutP50Ms: percentile(sortedPut, 50),
    checklistPutP95Ms: percentile(sortedPut, 95),
    syncLagP50Ms: sortedLag.length ? percentile(sortedLag, 50) : null,
    syncLagP95Ms: sortedLag.length ? percentile(sortedLag, 95) : null,
  };
}

async function runSseObserver(sessionId, pendingLags, counters) {
  let etag = null;
  const initial = await getChecklist(sessionId, null);
  counters.gets += 1;
  counters.getMs.push(initial.ms);
  if (initial.etag) etag = initial.etag;
  const tabMs = await fetchSessions();
  counters.sessionsGets += 1;
  counters.sessionsMs.push(tabMs);

  const ac = new AbortController();
  const res = await fetch(
    `${baseUrl}/api/checklist/events?sessionId=${encodeURIComponent(sessionId)}`,
    {
      headers: { Accept: "text/event-stream" },
      signal: ac.signal,
      cache: "no-store",
    },
  );
  if (!res.ok || !res.body) {
    throw new Error(`SSE connect failed ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const readLoop = (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const lines = part.split("\n");
        let eventName = "message";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (eventName !== "checklist_updated") continue;
        counters.events += 1;
        let expectedAt = null;
        try {
          expectedAt = JSON.parse(data)?.updatedAt ?? null;
        } catch {
          /* ignore */
        }
        const tab = await fetchSessions();
        counters.sessionsGets += 1;
        counters.sessionsMs.push(tab);
        const result = await getChecklist(sessionId, etag);
        counters.gets += 1;
        counters.getMs.push(result.ms);
        if (result.etag) etag = result.etag;
        if (expectedAt && pendingLags.has(expectedAt)) {
          counters.syncLags.push(performance.now() - pendingLags.get(expectedAt));
        }
      }
    }
  })();

  return {
    stop: async () => {
      ac.abort();
      try {
        await readLoop;
      } catch {
        /* aborted */
      }
    },
  };
}

async function runSseMode(sessionId) {
  let puts = 0;
  let putMs = [];
  const pendingLags = new Map();
  const counters = {
    gets: 0,
    getMs: [],
    sessionsGets: 0,
    sessionsMs: [],
    events: 0,
    syncLags: [],
    idleGets: 0,
  };

  const observers = [];
  for (let i = 0; i < OBSERVERS; i++) {
    observers.push(await runSseObserver(sessionId, pendingLags, counters));
  }

  // Idle: SSE observers stay connected with no checklist GETs beyond connect hydrate.
  const getsAfterConnect = counters.gets;
  await sleep(IDLE_MS);
  counters.idleGets = Math.max(0, counters.gets - getsAfterConnect);

  const endAt = Date.now() + ACTIVE_MS;
  while (Date.now() < endAt && puts < PUT_COUNT) {
    const writeStarted = performance.now();
    const { session, ms } = await bumpSession(sessionId);
    puts += 1;
    putMs.push(ms);
    pendingLags.set(session.updatedAt, writeStarted);
    await sleep(Math.floor(ACTIVE_MS / PUT_COUNT));
  }

  await sleep(1500);
  await Promise.all(observers.map((o) => o.stop()));

  return summarize("sse", {
    gets: counters.gets,
    getMs: counters.getMs,
    puts,
    putMs,
    syncLags: counters.syncLags,
    events: counters.events,
    sessionsGets: counters.sessionsGets,
    sessionsMs: counters.sessionsMs,
    idleGets: counters.idleGets,
  });
}

function loadPollBaseline() {
  if (!fs.existsSync(pollBaselinePath)) return null;
  return JSON.parse(fs.readFileSync(pollBaselinePath, "utf8"));
}

async function main() {
  const list = await listSessions();
  const sessionId = list.activeSessionId || list.sessions?.[0]?.id;
  if (!sessionId) {
    throw new Error("No checklist session available for compare.");
  }

  console.log(`Comparing against ${baseUrl} session ${sessionId}`);
  console.log(
    `Idle ${IDLE_MS}ms + active ${ACTIVE_MS}ms, puts ${PUT_COUNT}, observers ${OBSERVERS}`,
  );

  const poll = await runPollMode(sessionId);
  await sleep(1000);
  const sse = await runSseMode(sessionId);
  const historical = loadPollBaseline();

  const getsPerPutMeaning =
    "checklist GETs / PUTs — how many checklist reads ran for each write. High under polling (idle tabs keep GETting); lower under SSE (reads mostly follow real updates).";

  const out = {
    at: new Date().toISOString(),
    baseUrl,
    sessionId,
    /** Long-running poll capture: checklist GET count + gets/puts only. */
    pollEra: historical
      ? {
          checklistGetCount: historical.checklistGetCount,
          checklistPutCount: historical.checklistPutCount,
          checklistGetsPerPut: historical.checklistGetsPerPut,
          meaning: getsPerPutMeaning,
        }
      : null,
    livePoll: poll,
    liveSse: sse,
    deltas: {
      idleChecklistGets: {
        poll: poll.checklistGetIdleCount,
        sse: sse.checklistGetIdleCount,
        reductionPct:
          ((poll.checklistGetIdleCount - sse.checklistGetIdleCount) /
            Math.max(1, poll.checklistGetIdleCount)) *
          100,
      },
      getsPerPut: {
        meaning: getsPerPutMeaning,
        pollEra: historical?.checklistGetsPerPut ?? null,
        livePoll: poll.checklistGetsPerPut,
        liveSse: sse.checklistGetsPerPut,
        liveImprovementPct:
          poll.checklistGetsPerPut != null && sse.checklistGetsPerPut != null
            ? ((poll.checklistGetsPerPut - sse.checklistGetsPerPut) /
                poll.checklistGetsPerPut) *
              100
            : null,
      },
      checklistGetCount: {
        pollEra: historical?.checklistGetCount ?? null,
        livePoll: poll.checklistGetCount,
        liveSse: sse.checklistGetCount,
        liveReductionPct:
          ((poll.checklistGetCount - sse.checklistGetCount) /
            Math.max(1, poll.checklistGetCount)) *
          100,
      },
    },
  };

  fs.mkdirSync(baselinesDir, { recursive: true });
  const outPath = path.join(baselinesDir, "sse-vs-poll.json");
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);

  console.log(
    `\n=== Live poll vs SSE (${OBSERVERS} observers, idle ${IDLE_MS}ms + active ${ACTIVE_MS}ms) ===`,
  );
  console.log(
    `Idle checklist GETs — poll ${poll.checklistGetIdleCount}, sse ${sse.checklistGetIdleCount} (${out.deltas.idleChecklistGets.reductionPct.toFixed(1)}% fewer)`,
  );
  console.log(
    `Poll total: ${poll.checklistGetCount} checklist + ${poll.checklistSessionsGetCount} sessions / ${poll.checklistPutCount} PUTs → ${poll.checklistGetsPerPut?.toFixed(2)} gets/put`,
  );
  console.log(
    `SSE total:  ${sse.checklistGetCount} checklist + ${sse.checklistSessionsGetCount} sessions / ${sse.checklistPutCount} PUTs → ${sse.checklistGetsPerPut?.toFixed(2)} gets/put (${sse.sseEventCount} events)`,
  );
  if (sse.syncLagP50Ms != null) {
    console.log(
      `SSE sync lag p50/p95: ${sse.syncLagP50Ms.toFixed(1)}ms / ${sse.syncLagP95Ms.toFixed(1)}ms`,
    );
  }
  console.log(
    `GET latency p50 — poll ${poll.checklistGetP50Ms.toFixed(1)}ms, sse ${sse.checklistGetP50Ms.toFixed(1)}ms`,
  );
  if (out.deltas.getsPerPut.liveImprovementPct != null) {
    console.log(
      `Gets/puts improvement (live total): ${out.deltas.getsPerPut.liveImprovementPct.toFixed(1)}%`,
    );
  }
  if (historical) {
    console.log("\n=== Poll-era capture (pre-SSE) ===");
    console.log(
      `Checklist GETs: ${historical.checklistGetCount} (poll reads only)`,
    );
    console.log(
      `Gets/puts: ${historical.checklistGetsPerPut?.toFixed(2)} (${historical.checklistGetCount} GETs / ${historical.checklistPutCount} PUTs)`,
    );
    console.log(`Meaning: ${getsPerPutMeaning}`);
    if (sse.checklistGetsPerPut != null && historical.checklistGetsPerPut != null) {
      console.log(
        `SSE live gets/puts: ${sse.checklistGetsPerPut.toFixed(2)} (same meaning; lower is less read waste)`,
      );
    }
  }
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
