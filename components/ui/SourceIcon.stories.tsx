import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SourceIcon } from "./SourceIcon";

const meta = {
  title: "UI/SourceIcon",
  component: SourceIcon,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof SourceIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <span className="text-rsi-text-secondary">
      <SourceIcon />
    </span>
  ),
};
