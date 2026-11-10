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
          "Session contracts list with box-type picker (auto-selected vs corrected).",
      },
    },
  },
  args: {
    open: true,
    missions: mockSessionChecklist.missions,
    onClose: () => {},
    onToggleHidden: () => {},
    onToggleCompleted: () => {},
    onRemoveMission: () => {},
    onSelectBoxBreakdown: () => {},
  },
} satisfies Meta<typeof SessionMissionsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Contracts start collapsed; use Expand all / Collapse all or the chevron per card. */
export const BlockList: Story = {};

export const Empty: Story = {
  args: {
    missions: [],
  },
};
