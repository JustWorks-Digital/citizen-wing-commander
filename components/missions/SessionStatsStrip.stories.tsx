import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SessionStatsStrip } from "./SessionStatsStrip";

const meta = {
  title: "Missions/SessionStatsStrip",
  component: SessionStatsStrip,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Compact session telemetry strip for the cargo-layout header: source, deliveries, missions, inventory.",
      },
    },
  },
  args: {
    completedLegs: 1,
    totalLegs: 3,
    missionsCompleted: 0,
    missionCount: 2,
    onboardScu: 24,
    totalCapacity: 96,
    missionCargoScu: 48,
  },
} satisfies Meta<typeof SessionStatsStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OverCapacity: Story = {
  args: {
    onboardScu: 110,
    totalCapacity: 96,
    missionCargoScu: 120,
    isOverCapacity: true,
    isMissionOverCapacity: true,
  },
};

export const SingleDelivery: Story = {
  args: {
    completedLegs: 0,
    totalLegs: 1,
  },
};

export const NoShipCapacity: Story = {
  args: {
    totalCapacity: 0,
    onboardScu: 0,
  },
};
