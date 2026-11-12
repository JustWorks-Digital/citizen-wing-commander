import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import {
  CargoBayLayout,
  type CargoBayStopScope,
} from "./CargoBayLayout";
import {
  SessionContractScuGrid,
  SessionInventoryStat,
} from "./SessionStatsStrip";

const meta = {
  title: "Missions/CargoBayLayout",
  component: CargoBayLayout,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Trip cargo layout as the ship’s bay grid at the active stop (cargoBay.packAtStop with stopId first). Header can show Contracts total + bay load; footer shows stop transfer SCU (left) + per-contract SCU (right). Optional All / Transfer scope, 2D/Split/3D tabs, Packing + Peel, Manual presets, height drag handle.",
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
    headerAside: (
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
        showContractBreakdown={false}
      />
    ),
    footerAside: (
      <SessionContractScuGrid
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
