import type { PerfMetricAgg, PerfRun } from "@/lib/perf/types";

/** Metrics that matter for poll → SSE checklist sync comparisons. */
export const POLL_BASELINE_METRIC_NAMES = [
  "/api/checklist",
  "/api/checklist/sessions",
  "checklist.get",
  "checklist.put",
  "checklist.sessions.get",
  "deliverySessions.get",
  "deliverySessions.listActiveTabs",
  "deliverySessions.updateChecklist",
  "heap.periodic",
  "heap.session-start",
] as const;

export type PollBaselineCompare = {
  label: string;
  basedOnRunId: string;
  gitSha: string | null;
  at: string;
  checklistGetCount: number;
  checklistGetP50Ms: number;
  checklistGetP95Ms: number;
  checklistSessionsGetCount: number;
  checklistSessionsGetP50Ms: number;
  checklistSessionsGetP95Ms: number;
  checklistPutCount: number;
  checklistPutP50Ms: number;
  checklistPutP95Ms: number;
  checklistGetsPerPut: number | null;
  sessionsGetsPerPut: number | null;
  apiChecklistP50Ms: number;
  apiChecklistP95Ms: number;
  apiChecklistSessionsP50Ms: number;
  apiChecklistSessionsP95Ms: number;
  deliverySessionsListActiveTabsP50Ms: number;
  deliverySessionsListActiveTabsP95Ms: number;
  heapPeriodicP50Bytes: number;
  heapPeriodicP95Bytes: number;
  heapPeriodicP50Mb: number;
  heapPeriodicP95Mb: number;
  heapSessionStartP50Bytes: number;
  heapSessionStartP95Bytes: number;
  heapSessionStartP50Mb: number;
  heapSessionStartP95Mb: number;
  notes: string[];
};

function metric(metrics: PerfMetricAgg[], name: string): PerfMetricAgg | null {
  return metrics.find((m) => m.name === name) ?? null;
}

export function filterPollBaselineMetrics(
  metrics: PerfMetricAgg[],
): PerfMetricAgg[] {
  const allow = new Set<string>(POLL_BASELINE_METRIC_NAMES);
  return metrics.filter((m) => allow.has(m.name));
}

export function buildPollBaselineCompare(
  run: Pick<PerfRun, "id" | "gitSha" | "at" | "metrics">,
  label = "poll-pre-sse",
): PollBaselineCompare {
  const get = metric(run.metrics, "checklist.get");
  const sessions = metric(run.metrics, "checklist.sessions.get");
  const put = metric(run.metrics, "checklist.put");
  const tabs = metric(run.metrics, "deliverySessions.listActiveTabs");
  const apiChecklist = metric(run.metrics, "/api/checklist");
  const apiSessions = metric(run.metrics, "/api/checklist/sessions");
  const heapPeriodic = metric(run.metrics, "heap.periodic");
  const heapStart = metric(run.metrics, "heap.session-start");
  const putCount = put?.count ?? 0;
  const bytesToMb = (n: number) => Math.round((n / 1048576) * 10) / 10;

  return {
    label,
    basedOnRunId: run.id,
    gitSha: run.gitSha,
    at: run.at,
    checklistGetCount: get?.count ?? 0,
    checklistGetP50Ms: get?.p50 ?? 0,
    checklistGetP95Ms: get?.p95 ?? 0,
    checklistSessionsGetCount: sessions?.count ?? 0,
    checklistSessionsGetP50Ms: sessions?.p50 ?? 0,
    checklistSessionsGetP95Ms: sessions?.p95 ?? 0,
    checklistPutCount: putCount,
    checklistPutP50Ms: put?.p50 ?? 0,
    checklistPutP95Ms: put?.p95 ?? 0,
    checklistGetsPerPut:
      putCount > 0 && get ? get.count / putCount : null,
    sessionsGetsPerPut:
      putCount > 0 && sessions ? sessions.count / putCount : null,
    apiChecklistP50Ms: apiChecklist?.p50 ?? 0,
    apiChecklistP95Ms: apiChecklist?.p95 ?? 0,
    apiChecklistSessionsP50Ms: apiSessions?.p50 ?? 0,
    apiChecklistSessionsP95Ms: apiSessions?.p95 ?? 0,
    deliverySessionsListActiveTabsP50Ms: tabs?.p50 ?? 0,
    deliverySessionsListActiveTabsP95Ms: tabs?.p95 ?? 0,
    heapPeriodicP50Bytes: heapPeriodic?.p50 ?? 0,
    heapPeriodicP95Bytes: heapPeriodic?.p95 ?? 0,
    heapPeriodicP50Mb: bytesToMb(heapPeriodic?.p50 ?? 0),
    heapPeriodicP95Mb: bytesToMb(heapPeriodic?.p95 ?? 0),
    heapSessionStartP50Bytes: heapStart?.p50 ?? 0,
    heapSessionStartP95Bytes: heapStart?.p95 ?? 0,
    heapSessionStartP50Mb: bytesToMb(heapStart?.p50 ?? 0),
    heapSessionStartP95Mb: bytesToMb(heapStart?.p95 ?? 0),
    notes: [
      "Poll-era reference before SSE trip sync.",
      "Primary win signal after SSE: checklist.get and checklist.sessions.get counts drop vs checklist.put (gets-per-put).",
      "Latency p50/p95 on checklist.get should stay similar or improve; listActiveTabs volume should fall with sessions polling.",
      "Heap p50/p95 (periodic) is a soft signal — expect less churn under SSE idle, not necessarily a huge absolute drop.",
    ],
  };
}
