import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { SessionInventoryStat } from "./SessionStatsStrip";
import { SessionCargoLayoutModal } from "./SessionCargoLayoutModal";

const meta = {
  title: "Missions/SessionCargoLayoutModal",
  component: SessionCargoLayoutModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Centered Cargo bays modal from sticky Cargo bay. Embeds CargoBayLayout with All stops / Current stop scope toggle; left edge resizes width (persisted per session). X sits in the mask above the panel (Esc / backdrop also dismiss). Header shows per-contract SCU, Contracts total, and bay load.",
      },
    },
  },
} satisfies Meta<typeof SessionCargoLayoutModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    open: true,
    rows: mockSessionChecklist.rows,
    shipSlug: mockSessionChecklist.shipSlugs[0] ?? "c2-hercules-starlifter",
    sessionId: mockSessionChecklist.id,
    focusedStopId: mockSessionChecklist.rows[0]?.id ?? null,
    onClose: () => {},
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
        sessionId={mockSessionChecklist.id}
        totalCapacity={696}
        availableScu={624}
      />
    ),
  },
};
