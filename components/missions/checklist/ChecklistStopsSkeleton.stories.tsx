import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ChecklistStopsSkeleton } from "./ChecklistStopsSkeleton";

const meta = {
  title: "Missions/Checklist/ChecklistStopsSkeleton",
  component: ChecklistStopsSkeleton,
  parameters: {
    docs: {
      description: {
        component:
          "Stops rail + sticky toolbar + stop-card placeholders (Drop off / Pick up tabs, transfer + mission cards, pad graph) while a trip session hydrates.",
      },
    },
  },
} satisfies Meta<typeof ChecklistStopsSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dense: Story = {
  args: {
    cards: 5,
    railStops: 8,
  },
};
