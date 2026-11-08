import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AppShell } from "./AppShell";

const meta = {
  title: "Layout/AppShell",
  component: AppShell,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <p className="text-sm text-rsi-text-secondary">Session content</p>
    ),
  },
};
