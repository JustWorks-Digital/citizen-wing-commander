import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import {
  SessionContractScuGrid,
  SessionInventoryStat,
} from "./SessionStatsStrip";
import { SessionCargoLayoutModal } from "./SessionCargoLayoutModal";

const demoContracts = [
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
];

const meta = {
  title: "Missions/SessionCargoLayoutModal",
  component: SessionCargoLayoutModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Centered Cargo bays modal from sticky Cargo bay. Embeds CargoBayLayout with All stops / Current stop scope toggle; left edge resizes width (persisted per session). X sits in the mask above the panel (Esc / backdrop also dismiss). Header shows Contracts total + bay load; footer shows per-contract SCU as a 4-per-column grid.",
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
        missionScuBreakdown={demoContracts}
        sessionId={mockSessionChecklist.id}
        totalCapacity={696}
        availableScu={624}
        showContractBreakdown={false}
      />
    ),
    footerAside: (
      <SessionContractScuGrid
        missionScuBreakdown={demoContracts}
        sessionId={mockSessionChecklist.id}
      />
    ),
  },
};
