import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  SessionInventoryStat,
  SessionRouteProgressStats,
  SessionSourceStat,
} from "./SessionStatsStrip";

const meta = {
  title: "Missions/SessionStats",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Split session telemetry: Source (session header), Deliveries/Missions (checklist toolbar), Inventory (cargo layout).",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Source: Story = {
  render: () => <SessionSourceStat />,
};

export const RouteProgress: Story = {
  render: () => (
    <SessionRouteProgressStats
      completedLegs={1}
      totalLegs={3}
      missionsCompleted={0}
      missionCount={2}
    />
  ),
};

export const Inventory: Story = {
  render: () => (
    <SessionInventoryStat
      onboardScu={24}
      peakScu={72}
      missionsTotalScu={144}
      totalCapacity={96}
      availableScu={24}
    />
  ),
};

export const InventoryOverCapacity: Story = {
  render: () => (
    <SessionInventoryStat
      onboardScu={110}
      peakScu={120}
      missionsTotalScu={280}
      totalCapacity={96}
      availableScu={-24}
      isOverCapacity
    />
  ),
};

export const AllPieces: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <SessionSourceStat />
      <SessionRouteProgressStats
        completedLegs={1}
        totalLegs={3}
        missionsCompleted={0}
        missionCount={2}
      />
      <SessionInventoryStat
        onboardScu={24}
        peakScu={72}
        missionsTotalScu={144}
        totalCapacity={96}
        availableScu={24}
      />
    </div>
  ),
};
