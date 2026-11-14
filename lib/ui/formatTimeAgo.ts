/**
 * Relative age from an ISO timestamp / epoch ms.
 * Seconds under 1m, then minutes, hours, days (e.g. `45s ago`, `12m ago`, `3h ago`, `2d ago`).
 */
export function formatTimeAgo(
  createdAt: string | number | Date,
  nowMs = Date.now(),
): string {
  const start =
    createdAt instanceof Date
      ? createdAt.getTime()
      : typeof createdAt === "number"
        ? createdAt
        : Date.parse(createdAt);
  if (Number.isNaN(start)) return "—";

  const elapsedMs = Math.max(0, nowMs - start);
  const totalSeconds = Math.floor(elapsedMs / 1000);
  if (totalSeconds < 60) {
    return totalSeconds <= 1 ? "1s ago" : `${totalSeconds}s ago`;
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m ago`;
  }
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    return `${totalHours}h ago`;
  }
  const totalDays = Math.floor(totalHours / 24);
  return `${totalDays}d ago`;
}
