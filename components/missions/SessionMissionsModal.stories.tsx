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
          "Session contracts as tiles: box icons open quick box-type edit, Details expands Collect/Deliver, ⋯ menu for complete/hide/delete.",
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

/** Tile grid; Boxes opens the crate-mix modal; Details toggles Collect/Deliver on all tiles. */
export const BlockList: Story = {};

export const Empty: Story = {
  args: {
    missions: [],
  },
};
