"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IntakeUploadsView } from "./IntakeUploadsView";

const meta = {
  title: "Intake/IntakeUploadsView",
  component: IntakeUploadsView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Header Intake page: paste (⌘V), clipboard button, drop, or browse contract/mission screenshots into the pending inbox. Done moves a shot to processed for AI post-intake.",
      },
    },
  },
} satisfies Meta<typeof IntakeUploadsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    initialPending: [],
    initialProcessed: [],
  },
};

export const WithPending: Story = {
  args: {
    initialPending: [
      {
        status: "pending",
        logicalPath: "intake-pending/demo-contract.png",
        filename: "demo-contract.png",
        bytes: 48_000,
        mtime: new Date().toISOString(),
        url: "/icons/commodities/processed-food.svg",
      },
    ],
    initialProcessed: [
      {
        status: "processed",
        logicalPath: "intake-processed/done-haul.png",
        filename: "done-haul.png",
        bytes: 32_000,
        mtime: new Date().toISOString(),
        url: "/icons/commodities/pressurized-ice.svg",
      },
    ],
  },
};
