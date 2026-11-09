import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  mockSessionChecklist,
  type HaulingChecklistRow,
} from "@/lib/missions/mockSession";
import { StopDeliveryBayPreview } from "./StopDeliveryBayPreview";

const deliveryRow =
  mockSessionChecklist.rows.find((row) =>
    row.cargoDeliveries.some(
      (cargo) => cargo.role === "delivery" || row.legKind === "delivery",
    ),
  ) ?? mockSessionChecklist.rows[0]!;

const pickupRow =
  mockSessionChecklist.rows.find((row) =>
    row.cargoDeliveries.some(
      (cargo) => cargo.role === "pickup" || row.legKind === "pickup",
    ),
  ) ?? mockSessionChecklist.rows[0]!;

const bothRow: HaulingChecklistRow = {
  id: "leg-both",
  legKind: "both",
  locationSlug: "orison",
  shipStorageLocation: "front",
  distanceToNext: null,
  isCompleted: false,
  cargoDeliveries: [
    {
      commoditySlug: "scrap",
      scu: 16,
      role: "delivery",
      missionId: "mission-delivery",
      boxSizes: [8, 8],
    },
    {
      commoditySlug: "agricium",
      scu: 8,
      role: "pickup",
      missionId: "mission-pickup",
      boxSizes: [8],
    },
  ],
};

const meta = {
  title: "Missions/StopDeliveryBayPreview",
  component: StopDeliveryBayPreview,
  parameters: { layout: "padded" },
  args: {
    row: deliveryRow,
  },
} satisfies Meta<typeof StopDeliveryBayPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DeliveryOnly: Story = {};

export const PickupOnly: Story = {
  args: { row: pickupRow },
};

export const PickupAndDelivery: Story = {
  args: { row: bothRow },
};
