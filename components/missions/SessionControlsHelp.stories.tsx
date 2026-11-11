import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SessionControlsHelp } from "./SessionControlsHelp";

const meta = {
  title: "Missions/SessionControlsHelp",
  component: SessionControlsHelp,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Small Controls link for the checklist sticky toolbar. Opens a compact keyboard shortcut panel (B / S / C / H / D).",
      },
    },
  },
} satisfies Meta<typeof SessionControlsHelp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
