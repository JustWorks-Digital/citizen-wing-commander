import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { SessionMissionsModal } from "./SessionMissionsModal";

const meta = {
  title: "Missions/SessionMissionsModal",
  component: SessionMissionsModal,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    open: true,
    missions: mockSessionChecklist.missions,
    onClose: () => {},
    onRemoveMission: () => {},
  },
} satisfies Meta<typeof SessionMissionsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tiles: Story = {};

export const Empty: Story = {
  args: {
    missions: [],
  },
};
