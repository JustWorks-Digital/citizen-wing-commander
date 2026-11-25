import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";

import {
  CargoBayLayout,
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
          "Trip cargo layout as the ship’s bay grid at the active stop (cargoBay.packAtStop with stopId first). Header can show stop transfer SCU (left of Contracts total), On grid (All-tab placed / capacity), and bay load. 2D/Split/3D sits on the top border of the graph (centered between panes in Split). Packing + All/Transfer sit above the left grid; Peel left of Legend top-right. Packing Type (Automatic By cargo type / By contract / External, or Manual with Blank/auto seed; custom templates also appear as Base template options on their own line after External). Legend Settings Overlay (float vs push). Standalone Storybook keeps a bottom height handle; the trip modal uses a corner resize for width+height.",
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
    const [stopScope, setStopScope] = useState<CargoBayStopScope>("transfer");
    return (
      <CargoBayLayout
        {...args}
        stopScope={stopScope}
        onStopScopeChange={setStopScope}
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
