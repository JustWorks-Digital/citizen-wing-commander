import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { CargoBayLayout } from "./CargoBayLayout";
import { SessionInventoryStat } from "./SessionStatsStrip";

const meta = {
  title: "Missions/CargoBayLayout",
  component: CargoBayLayout,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Session cargo layout as the ship’s bay grid at the active stop, with 2D/Split/3D tabs (default Split), Sorting + Peel toggles (same chrome row), left Sorting panel (Suggested / Cargo type / Contract based / Manual), right Legend, Front/Rear rails, optional inventory beside the title (per-contract SCU + totals), and a bottom drag handle to resize panel height. Manual mode: drag crates on 2D (3D follows); session-local presets as neutral badges. Legend/Sorting start hidden on new sessions; view tab + chrome + Manual presets persist per session in localStorage (survives modal close).",
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
      />
    ),
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
