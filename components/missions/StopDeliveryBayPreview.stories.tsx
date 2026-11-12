import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  mockSessionChecklist,
  type HaulingChecklistRow,
} from "@/lib/missions/mockSession";
import { StopDeliveryBayPreview } from "./StopDeliveryBayPreview";

const deliveryRow =
  mockSessionChecklist.rows.find((row) =>
    row.cargoDeliveries.some(
      (cargo) => cargo.role === "delivery" || row.routeAction === "delivery",
    ),
  ) ?? mockSessionChecklist.rows[0]!;

const pickupRow =
  mockSessionChecklist.rows.find((row) =>
    row.cargoDeliveries.some(
      (cargo) => cargo.role === "pickup" || row.routeAction === "pickup",
    ),
  ) ?? mockSessionChecklist.rows[0]!;

const bothRow: HaulingChecklistRow = {
  id: "leg-both",
  routeAction: "both",
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

/** Multi-stop route so Pickup → Piles can attribute crates by delivery location. */
const hangarPileRows: HaulingChecklistRow[] = [
  {
    id: "pile-pickup",
    routeAction: "pickup",
    locationSlug: "everus-harbor",
    shipStorageLocation: "front",
    distanceToNext: { value: 1, unit: "Mm" },
    isCompleted: false,
    cargoDeliveries: [
      {
        commoditySlug: "quartz",
        scu: 14,
        role: "pickup",
        missionId: "mission-quartz",
        boxSizes: [8, 4, 2],
      },
      {
        commoditySlug: "stims",
        scu: 10,
        role: "pickup",
        missionId: "mission-stims",
        boxSizes: [8, 2],
      },
    ],
  },
  {
    id: "pile-cassillo",
    routeAction: "delivery",
    locationSlug: "hdpc-cassillo",
    shipStorageLocation: "front",
    distanceToNext: { value: 1, unit: "Mm" },
    isCompleted: false,
    cargoDeliveries: [
      {
        commoditySlug: "quartz",
        scu: 6,
        role: "delivery",
        missionId: "mission-quartz",
        boxSizes: [4, 2],
      },
      {
        commoditySlug: "stims",
        scu: 4,
        role: "delivery",
        missionId: "mission-stims",
        boxSizes: [2, 2],
      },
    ],
  },
  {
    id: "pile-lorville",
    routeAction: "delivery",
    locationSlug: "lorville",
    shipStorageLocation: "front",
    distanceToNext: null,
    isCompleted: false,
    cargoDeliveries: [
      {
        commoditySlug: "quartz",
        scu: 8,
        role: "delivery",
        missionId: "mission-quartz",
        boxSizes: [8],
      },
      {
        commoditySlug: "stims",
        scu: 6,
        role: "delivery",
        missionId: "mission-stims",
        boxSizes: [4, 2],
      },
    ],
  },
];

const meta = {
  title: "Missions/StopDeliveryBayPreview",
  component: StopDeliveryBayPreview,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Flat pad stacks for stop cargo. Pickup stops with a route can switch Cargo (by commodity) ↔ Piles (hangar piles by delivery location). Double-click the under-stack cargo label (abbrev + SCU) — or a Breakdown row — to edit that mission’s box types when `onEditMissionBoxes` is provided.",
      },
    },
  },
  args: {
    row: deliveryRow,
    onEditMissionBoxes: (missionId: string) => {
      console.info("edit box types", missionId);
    },
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

export const PickupHangarPiles: Story = {
  args: {
    row: hangarPileRows[0],
    rows: hangarPileRows,
  },
};
