import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { SessionMissionDetailModal } from "./SessionMissionDetailModal";

const demo = mockSessionChecklist.missions[0]!;

const meta = {
  title: "Missions/SessionMissionDetailModal",
  component: SessionMissionDetailModal,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof SessionMissionDetailModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    mission: demo,
    onClose: () => undefined,
  },
  render: function Render(args) {
    const [open, setOpen] = useState(true);
    if (!open) {
      return (
        <button
          type="button"
          className="m-4 rounded-rsi border border-rsi-border px-3 py-2 text-sm text-rsi-text"
          onClick={() => setOpen(true)}
        >
          Open contract detail
        </button>
      );
    }
    return (
      <SessionMissionDetailModal
        {...args}
        onClose={() => setOpen(false)}
      />
    );
  },
};
