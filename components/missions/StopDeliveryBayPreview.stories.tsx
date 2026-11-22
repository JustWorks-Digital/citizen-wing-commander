import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { stopCargoRole } from "@/lib/missions/stopDeliveryBoxes";

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
  routeAction: "pickup_delivery",
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
          "Flat pad stacks for stop cargo. Graph headers say Dropped off / Picked up. Pass `role` to show only one graph (checklist aligns each with that left Drop off / Pick up section). Both-stops render drop-off then pick-up. Pick up stops with a route can switch Cargo ↔ Piles. Click a crate or under-stack abbrev/box to edit crate mix (`onEditMissionBoxes`). Double-click under-stack SCU on pick-up or drop-off to edit quantity (`onSetPickupScu` / `onSetDeliveryScu`; remaining same-role stops rebalance on blur; 0 clears). Under-stack SCU chips use each cargo type’s commodity color. Skip pick-up lives on the mission card (left of the pad), not on this graph. Header checkbox marks all cargo of that role handled and stamps the graph.",
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

function InteractiveRoleHandled({
  row,
  role,
}: {
  row: HaulingChecklistRow;
  role?: "pickup" | "delivery";
}) {
  const [liveRow, setLiveRow] = useState(row);
  return (
    <StopDeliveryBayPreview
      row={liveRow}
      role={role}
      onSetCargoRoleHandled={(cargoRole, handled) => {
        setLiveRow((current) =>
          stopCargoRole.withHandled(current, cargoRole, handled),
        );
      }}
    />
  );
}

export const DeliveryOnly: Story = {
  args: { row: deliveryRow, role: "delivery" },
  render: (args) => (
    <InteractiveRoleHandled row={args.row} role="delivery" />
  ),
};

export const PickupOnly: Story = {
  args: { row: pickupRow, role: "pickup" },
  render: (args) => <InteractiveRoleHandled row={args.row} role="pickup" />,
};

export const PickupAndDelivery: Story = {
  args: { row: bothRow },
  render: (args) => <InteractiveRoleHandled row={args.row} />,
};

export const PickupHangarPiles: Story = {
  args: {
    row: hangarPileRows[0],
    rows: hangarPileRows,
  },
};
