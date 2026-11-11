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
          "Session ship layout as the ship’s bay grid at the active stop, with 2D/Split/3D tabs, Sorting + Peel toggles (same chrome row), left Sorting panel (Suggested / Cargo type / Contract based / Manual), right Legend, Front/Rear rails, optional inventory beside the title, and a bottom drag handle to resize panel height. Manual mode: drag crates on 2D (3D follows); session-local presets as neutral badges. Legend/Sorting start hidden on new sessions; chrome + Manual presets persist per session in localStorage.",
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
