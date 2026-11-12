import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  SessionContractScuGrid,
  SessionCurrentStopPickupGrid,
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
          "Split trip telemetry: Contracts List/Source (trip header), Contracts/Stops/Cargo bay/aUEC (route checklist toolbar), Inventory totals in the Cargo bays modal header, stop transfer SCU + per-contract SCU in the modal footer.",
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
      auecEarned={0}
      auecProjected={128000}
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
      missionsCompleted={1}
      missionCount={2}
      onboardScu={24}
      totalCapacity={96}
      cargoBayCount={1}
      auecEarned={48000}
      auecProjected={128000}
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

/** Four-per-column contract grid (footer of Cargo bays modal). */
export const ContractScuFourPerColumn: Story = {
  render: () => (
    <div className="flex w-full max-w-3xl flex-col gap-3">
      <SessionInventoryStat
        onboardScu={40}
        peakScu={180}
        missionsTotalScu={432}
        missionScuBreakdown={[]}
        totalCapacity={216}
        availableScu={36}
        showContractBreakdown={false}
      />
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <SessionCurrentStopPickupGrid
          stopLabel="Everus Harbor"
          transfers={[
            {
              action: "pickup",
              commoditySlug: "pressurized-ice",
              scu: 32,
            },
            {
              action: "pickup",
              commoditySlug: "processed-food",
              scu: 24,
            },
            { action: "pickup", commoditySlug: "agricium", scu: 40 },
          ]}
        />
        <SessionContractScuGrid
          missionScuBreakdown={Array.from({ length: 9 }, (_, index) => ({
            missionId: `m${index + 1}`,
            title: [
              "Trainee Rank — Medical Supplies",
              "Junior Rank — Quartz",
              "Member Rank — Stims",
              "Senior Rank — Waste",
              "Master Rank — Agricium",
              "Junior Rank — Pressurized Ice",
              "Member Rank — Processed Food",
              "Senior Rank — Scrap",
              "Trainee Rank — Distilled Spirits",
            ][index]!,
            scu: [16, 24, 48, 64, 80, 32, 40, 56, 72][index]!,
            screenshots: index % 2 === 0 ? [`demo/c${index + 1}.png`] : [],
          }))}
          sessionId="demo-session"
        />
      </div>
    </div>
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
        auecEarned={0}
        auecProjected={144000}
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
