import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { SessionChecklistView } from "./SessionChecklistView";

const meta = {
  title: "Missions/SessionChecklistView",
  component: SessionChecklistView,
  parameters: {
    layout: "padded",
  },
  args: {
    initial: mockSessionChecklist,
  },
} satisfies Meta<typeof SessionChecklistView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
