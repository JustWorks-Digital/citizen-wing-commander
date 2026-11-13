import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TripPlanInvalidBanner } from "./TripPlanInvalidBanner";

const meta = {
  title: "Missions/TripPlanInvalidBanner",
  component: TripPlanInvalidBanner,
  parameters: { layout: "padded" },
  args: {
    issues: [
      {
        stopId: "leg-1",
        locationSlug: "covalex-distribution-centre-s4dc05",
        missing: {
          commoditySlug: "scrap",
          scu: 10,
          missionId: "back",
        },
        shortfallScu: 10,
      },
    ],
    onRepair: () => undefined,
  },
} satisfies Meta<typeof TripPlanInvalidBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MultipleIssues: Story = {
  args: {
    issues: [
      {
        stopId: "leg-1",
        locationSlug: "covalex-distribution-centre-s4dc05",
        missing: {
          commoditySlug: "scrap",
          scu: 10,
          missionId: "back",
        },
        shortfallScu: 10,
      },
      {
        stopId: "leg-1",
        locationSlug: "covalex-distribution-centre-s4dc05",
        missing: {
          commoditySlug: "waste",
          scu: 8,
          missionId: "waste-run",
        },
        shortfallScu: 8,
      },
      {
        stopId: "leg-3",
        locationSlug: "shubin-mining-facility-sm0-13",
        missing: {
          commoditySlug: "quartz-raw",
          scu: 27,
          missionId: "quartz",
        },
        shortfallScu: 27,
      },
    ],
  },
};

export const Repairing: Story = {
  args: { isRepairing: true },
};

export const RepairFailed: Story = {
  args: {
    repairError: "Could not build a valid route from these contracts.",
  },
};
