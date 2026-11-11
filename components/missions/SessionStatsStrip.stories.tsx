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
          "Split session telemetry: Contracts List/Source (session header), Contracts/Stops/Cargo bay (checklist toolbar — opens Cargo layout modal), Inventory (inside Cargo layout modal, including per-contract SCU).",
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
      onboardScu={24}
      totalCapacity={96}
      cargoBayCount={2}
      onStopsClick={() => {}}
      onCapacityClick={() => {}}
    />
  ),
};

export const RouteProgressSingleBay: Story = {
  render: () => (
    <SessionRouteProgressStats
      completedLegs={1}
      totalLegs={3}
      missionsCompleted={0}
      missionCount={2}
      onboardScu={24}
      totalCapacity={96}
      cargoBayCount={1}
      onStopsClick={() => {}}
      onCapacityClick={() => {}}
    />
  ),
};

export const Inventory: Story = {
  render: () => (
    <SessionInventoryStat
      onboardScu={24}
      peakScu={72}
      missionsTotalScu={144}
      missionScuBreakdown={[
        {
          missionId: "m1",
          title: "Member Rank — Stims",
          scu: 96,
          screenshots: ["demo/stims.png"],
        },
        {
          missionId: "m2",
          title: "Junior Rank — Quartz",
          scu: 48,
          screenshots: [],
        },
      ]}
      sessionId="demo-session"
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
      missionScuBreakdown={[
        {
          missionId: "m1",
          title: "Senior Rank — Waste",
          scu: 160,
          screenshots: ["demo/waste.png"],
        },
        {
          missionId: "m2",
          title: "Member Rank — Ice",
          scu: 120,
          screenshots: [],
        },
      ]}
      sessionId="demo-session"
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
        onboardScu={24}
        totalCapacity={96}
      />
      <SessionInventoryStat
        onboardScu={24}
        peakScu={72}
        missionsTotalScu={144}
        missionScuBreakdown={[
          {
            missionId: "m1",
            title: "Member Rank — Stims",
            scu: 96,
            screenshots: ["demo/stims.png"],
          },
          {
            missionId: "m2",
            title: "Junior Rank — Quartz",
            scu: 48,
            screenshots: [],
          },
        ]}
        sessionId="demo-session"
        totalCapacity={96}
        availableScu={24}
      />
    </div>
  ),
};
