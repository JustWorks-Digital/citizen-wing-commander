import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";

import {
  CargoBayLayout,
  type CargoBayLayoutMode,
  type CargoBayStopScope,
} from "./CargoBayLayout";
import { SessionInventoryStat } from "./SessionStatsStrip";

const meta = {
  title: "Missions/CargoBayLayout",
  component: CargoBayLayout,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Trip cargo layout: Packing + Planned / Current sit just above the packing panel; All / {Stop} is at the top of the Legend panel. Planned is read-only; Current is the live bay Manual writes. Packing updates Planned; rearranges after progress update Current only. Header can show stop transfer SCU, On grid, and bay load. Standalone Storybook keeps a bottom height handle; the trip modal uses a corner resize for width+height.",
      },
    },
  },
  args: {
    rows: mockSessionChecklist.rows,
    shipSlug: mockSessionChecklist.shipSlugs[0] ?? "c2-hercules",
    sessionId: mockSessionChecklist.id,
  },
} satisfies Meta<typeof CargoBayLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** After every stop is Done, Current shows an empty bay; Planned keeps the pack. */
export const CompletedTripEmptyBay: Story = {
  args: {
    rows: mockSessionChecklist.rows.map((row) => ({
      ...row,
      isCompleted: true,
    })),
    stopScope: "all",
    bayLayout: "current",
    focusedStopId:
      mockSessionChecklist.rows[mockSessionChecklist.rows.length - 1]?.id ??
      null,
  },
};

export const WithInventory: Story = {
  args: {
    headerAside: ({ gridPlacedScu, stopTransfers, stopLabel }) => (
      <SessionInventoryStat
        onboardScu={24}
        peakScu={72}
        missionsTotalScu={144}
        gridPlacedScu={gridPlacedScu}
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
        stopTransfers={stopTransfers}
        stopLabel={stopLabel}
      />
    ),
  },
};

export const WithStopScope: Story = {
  render: function StopScopeDemo(args) {
    const [stopScope, setStopScope] = useState<CargoBayStopScope>("all");
    const [bayLayout, setBayLayout] = useState<CargoBayLayoutMode>("current");
    return (
      <CargoBayLayout
        {...args}
        stopScope={stopScope}
        onStopScopeChange={setStopScope}
        bayLayout={bayLayout}
        onBayLayoutChange={setBayLayout}
        focusedStopId={mockSessionChecklist.rows[0]?.id ?? null}
      />
    );
  },
};

export const NoShip: Story = {
  args: {
    shipSlug: null,
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
