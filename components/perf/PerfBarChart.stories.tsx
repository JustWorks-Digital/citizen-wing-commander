import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PerfBarChart } from "@/components/perf/PerfBarChart";

const meta = {
  title: "Perf/PerfBarChart",
  component: PerfBarChart,
  parameters: { layout: "padded" },
} satisfies Meta<typeof PerfBarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Live p50",
    metrics: [
      {
        kind: "db",
        name: "deliverySessions.listActiveTabs",
        count: 12,
        p50: 214,
        p95: 240,
        min: 200,
        max: 250,
        unit: "ms",
      },
      {
        kind: "api",
        name: "checklist.sessions.get",
        count: 12,
        p50: 218,
        p95: 260,
        min: 200,
        max: 280,
        unit: "ms",
      },
      {
        kind: "api",
        name: "checklist.get",
        count: 12,
        p50: 7,
        p95: 12,
        min: 5,
        max: 15,
        unit: "ms",
      },
      {
        kind: "ui",
        name: "cargo-bays.open",
        count: 2,
        p50: 38,
        p95: 45,
        min: 30,
        max: 50,
        unit: "ms",
      },
    ],
  },
};
