import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PerfTrendChart } from "@/components/perf/PerfTrendChart";
import type { PerfTrendSeries } from "@/lib/perf/trends";

const sampleSeries: PerfTrendSeries[] = [
  {
    key: "db:deliverySessions.listActiveTabs",
    kind: "db",
    name: "deliverySessions.listActiveTabs",
    unit: "ms",
    points: [
      { runId: "a", at: "2026-11-15T08:00:00.000Z", gitSha: "abc", p50: 210, p95: 240, unit: "ms" },
      { runId: "b", at: "2026-11-15T08:05:00.000Z", gitSha: "abc", p50: 225, p95: 260, unit: "ms" },
      { runId: "c", at: "2026-11-15T08:10:00.000Z", gitSha: "def", p50: 198, p95: 220, unit: "ms" },
      { runId: "d", at: "2026-11-15T08:15:00.000Z", gitSha: "def", p50: 185, p95: 210, unit: "ms" },
      { runId: "e", at: "2026-11-15T08:20:00.000Z", gitSha: "ghi", p50: 172, p95: 195, unit: "ms" },
    ],
  },
  {
    key: "api:checklist.get",
    kind: "api",
    name: "checklist.get",
    unit: "ms",
    points: [
      { runId: "a", at: "2026-11-15T08:00:00.000Z", gitSha: "abc", p50: 8, p95: 12, unit: "ms" },
      { runId: "b", at: "2026-11-15T08:05:00.000Z", gitSha: "abc", p50: 7, p95: 11, unit: "ms" },
      { runId: "c", at: "2026-11-15T08:10:00.000Z", gitSha: "def", p50: 9, p95: 14, unit: "ms" },
      { runId: "d", at: "2026-11-15T08:15:00.000Z", gitSha: "def", p50: 6, p95: 10, unit: "ms" },
      { runId: "e", at: "2026-11-15T08:20:00.000Z", gitSha: "ghi", p50: 7, p95: 9, unit: "ms" },
    ],
  },
];

const meta = {
  title: "Perf/PerfTrendChart",
  component: PerfTrendChart,
  parameters: { layout: "padded" },
} satisfies Meta<typeof PerfTrendChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    series: sampleSeries,
    title: "p50 over saved runs",
    valueLabel: "ms",
  },
};
