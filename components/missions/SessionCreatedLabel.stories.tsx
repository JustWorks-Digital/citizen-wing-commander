import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SessionCreatedLabel } from "./SessionCreatedLabel";

const meta = {
  title: "Missions/SessionCreatedLabel",
  component: SessionCreatedLabel,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof SessionCreatedLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MinutesAgo: Story = {
  args: {
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
};

export const HoursAgo: Story = {
  args: {
    createdAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
  },
};

export const DaysAgo: Story = {
  args: {
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString(),
  },
};
