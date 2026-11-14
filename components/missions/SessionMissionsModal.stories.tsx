import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { SessionMissionsModal } from "./SessionMissionsModal";

const meta = {
  title: "Missions/SessionMissionsModal",
  component: SessionMissionsModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Session contracts: stacked cards on small screens (no horizontal scroll); Rank / Title / Reward / SCU / EXP / From / To / Boxes / actions table from md+. Boxes always label the cargo type above the mix icons. Footer totals show earned/total for aUEC, SCU, and EXP; ⋯ menu for complete/hide/delete.",
      },
    },
  },
  args: {
    open: true,
    missions: mockSessionChecklist.missions,
    rows: mockSessionChecklist.rows,
    onClose: () => {},
    onToggleHidden: () => {},
    onToggleCompleted: () => {},
    onRemoveMission: () => {},
    onSelectBoxBreakdown: () => {},
  },
} satisfies Meta<typeof SessionMissionsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Desktop table / mobile cards; Boxes opens the crate-mix modal. */
export const Table: Story = {};

/** Mobile card layout (viewport ≤767px). */
export const MobileCards: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
/** Opened from a stop Contracts tile — focused row is highlighted. */
export const FocusedRow: Story = {
  args: {
    focusMissionId: mockSessionChecklist.missions[0]?.id ?? null,
  },
};

export const Empty: Story = {
  args: {
    missions: [],
  },
};
