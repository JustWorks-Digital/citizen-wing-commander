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
          "Split trip telemetry: Contracts/Source (trip header), route toolbar as two strips — Cargo left (Cargo | Aboard as aboard/capacity SCU | Peak | focused-stop ↑pickup / ↓drop-off), Prog right (Prog | Contracts with completed count and aUEC split by a rule | Time). Saving… sits left of Prog. Distance lives in the Stops rail / mobile Stops section.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Source: Story = {
  render: () => <SessionSourceStat />,
};

export const SourceWithPending: Story = {
  render: () => <SessionSourceStat pendingScreenshotCount={3} />,
};

export const SourcePlain: Story = {
  render: () => (
    <SessionSourceStat plain pendingScreenshotCount={2} />
  ),
};

export const RouteProgress: Story = {
  render: () => (
    <SessionRouteProgressStats
      completedLegs={1}
      totalLegs={3}
      missionsCompleted={0}
      missionCount={2}
      onboardScu={24}
      peakScu={72}
      totalCapacity={96}
      stopPickupScu={727}
      stopDeliveryScu={0}
      cargoBayCount={2}
      auecEarned={0}
      auecProjected={128000}
      onCapacityClick={() => {}}
      elapsed={<span>12m</span>}
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
      peakScu={72}
      totalCapacity={96}
      stopPickupScu={190}
      stopDeliveryScu={128}
      cargoBayCount={1}
      auecEarned={48000}
      auecProjected={128000}
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
      showContractBreakdown
    />
  ),
};

/** Inventory header + stop pickup grid (storage-bays modal pattern). */
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
      />
      <div className="flex min-w-0 flex-wrap items-start gap-3">
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

/** Galaxy-style: peak past snapped capacity, covered by unstable overflow. */
export const InventoryWithOverflow: Story = {
  render: () => (
    <SessionInventoryStat
      onboardScu={720}
      peakScu={727}
      missionsTotalScu={727}
      totalCapacity={720}
      availableScu={425}
      overflowScu={7}
      overflowCapacity={432}
    />
  ),
};

/** Cargo bays modal: Current stays mission-progress; On grid is placed bay SCU. */
export const InventoryWithOnGrid: Story = {
  render: () => (
    <SessionInventoryStat
      onboardScu={0}
      peakScu={727}
      missionsTotalScu={727}
      gridPlacedScu={727}
      totalCapacity={720}
      availableScu={425}
      overflowScu={7}
      overflowCapacity={432}
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
        peakScu={72}
        totalCapacity={96}
        auecEarned={0}
        auecProjected={144000}
        distanceTraveled={{ value: 0, unit: "km" }}
        distanceTotal={{ value: 450.5, unit: "km" }}
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
