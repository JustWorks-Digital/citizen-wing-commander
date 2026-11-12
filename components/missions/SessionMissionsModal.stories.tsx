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
          "Session contracts table: Rank / Title / Reward / SCU / EXP / From / To / Boxes / actions. Boxes always label the cargo type above the mix icons (single- or multi-cargo). Footer totals show earned/total for aUEC, SCU, and EXP; ⋯ menu for complete/hide/delete.",
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

/** Table of session contracts; Boxes opens the crate-mix modal. */
export const Table: Story = {};

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
