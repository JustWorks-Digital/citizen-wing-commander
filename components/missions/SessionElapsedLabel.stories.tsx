import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SessionElapsedLabel } from "./SessionElapsedLabel";

const meta = {
  title: "Missions/SessionElapsedLabel",
  component: SessionElapsedLabel,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Isolated session timer so the 1s tick does not re-render the cargo grid or checklist. `variant=\"value\"` is duration-only for the desktop toolbar Time cell.",
      },
    },
  },
  args: {
    session: {
      startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      completedAt: null,
    },
  },
} satisfies Meta<typeof SessionElapsedLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Running: Story = {};

export const Complete: Story = {
  args: {
    session: {
      startedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
      completedAt: new Date().toISOString(),
    },
  },
};

export const ToolbarValue: Story = {
  args: {
    variant: "value",
  },
};
