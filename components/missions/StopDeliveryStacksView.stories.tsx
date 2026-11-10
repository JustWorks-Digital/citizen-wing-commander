import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { HaulingChecklistRow } from "@/lib/missions/mockSession";
import { planStopCargoStacks } from "@/lib/missions/stopDeliveryBoxes";
import { StopDeliveryStacksView } from "./StopDeliveryStacksView";

const splitMissionRow: HaulingChecklistRow = {
  id: "leg-split",
  legKind: "delivery",
  locationSlug: "baijini-point",
  shipStorageLocation: "middle",
  distanceToNext: null,
  isCompleted: false,
  cargoDeliveries: [
    {
      commoditySlug: "agricultural-supplies",
      scu: 16,
      role: "delivery",
      missionId: "mission-a",
      boxSizes: [8, 8],
    },
    {
      commoditySlug: "agricultural-supplies",
      scu: 8,
      role: "delivery",
      missionId: "mission-b",
      boxSizes: [8],
    },
    {
      commoditySlug: "medical-supplies",
      scu: 4,
      role: "delivery",
      missionId: "mission-a",
      boxSizes: [4],
    },
  ],
};

const plan = planStopCargoStacks(splitMissionRow, "delivery")!;

const meta = {
  title: "Missions/StopDeliveryStacksView",
  component: StopDeliveryStacksView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Flat pickup/delivery crate stacks with Peel, Breakdown, and zoom (− / % / +) under Breakdown.",
      },
    },
  },
  args: { plan },
} satisfies Meta<typeof StopDeliveryStacksView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
