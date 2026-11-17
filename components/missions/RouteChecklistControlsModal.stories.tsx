import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { RouteChecklistControlsModal } from "./RouteChecklistControlsModal";

const meta = {
  title: "Missions/RouteChecklistControlsModal",
  component: RouteChecklistControlsModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Read-only keyboard shortcut list from the route checklist ⋯ → Controls. Escape or backdrop / close dismisses.",
      },
    },
  },
  args: {
    open: true,
    onClose: () => {},
  },
} satisfies Meta<typeof RouteChecklistControlsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Interactive: Story = {
  render: function InteractiveControls() {
    const [open, setOpen] = useState(true);
    return (
      <div className="min-h-[40vh] bg-rsi-bg-deep p-8">
        <button
          type="button"
          className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-accent"
          onClick={() => setOpen(true)}
        >
          Open controls
        </button>
        <RouteChecklistControlsModal
          open={open}
          onClose={() => setOpen(false)}
        />
      </div>
    );
  },
};
