import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SessionAcceptedContractsSkeleton } from "./SessionAcceptedContractsSkeleton";

const meta = {
  title: "Missions/SessionAcceptedContractsSkeleton",
  component: SessionAcceptedContractsSkeleton,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Accepted Contracts modal placeholder (mobile cards + desktop table) while rows paint.",
      },
    },
  },
} satisfies Meta<typeof SessionAcceptedContractsSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    rows: 5,
  },
};
