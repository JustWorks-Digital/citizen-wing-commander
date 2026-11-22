import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { describeCargoDeliveries } from "@/lib/fixtures";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import {
  CargoCommodityTile,
  CollapsedMissionCargoLines,
} from "./ChecklistCargoTiles";

const pickupRow: HaulingChecklistRow = {
  id: "stop-pickup",
  routeAction: "pickup",
  locationSlug: "covalex-distribution-centre-s4dc05",
  cargoDeliveries: [
    {
      commoditySlug: "stims",
      scu: 9,
      role: "pickup",
      shipStorageLocation: "middle",
      missionId: "mission-stims",
    },
    {
      commoditySlug: "waste",
      scu: 5,
      role: "pickup",
      shipStorageLocation: "rear",
      missionId: "mission-waste",
    },
  ],
  shipStorageLocation: "middle",
  distanceToNext: { value: 12, unit: "Mm" },
  isCompleted: false,
};

const lines = describeCargoDeliveries(pickupRow.cargoDeliveries);

const meta = {
  title: "Missions/ChecklistCargoTiles",
  component: CargoCommodityTile,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Stop cargo tiles: commodity icon top-left, SCU + name centered. Square tiles cap at max-w-28 so wide mission cards stay compact. Mission-card tile grids use 3 columns by default, 2 from lg (1024px) through 1149px, then 3 again from 1150px. Pickup tiles support skip and double-click SCU edit.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="@container/cargo w-36 max-w-[9rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CargoCommodityTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pickup: Story = {
  args: {
    row: pickupRow,
    line: lines[0]!,
    isPickup: true,
    handledVerb: "picked up",
    doneClass: "opacity-50",
    onToggleCargoHandled: () => undefined,
  },
};

export const Delivery: Story = {
  args: {
    row: { ...pickupRow, routeAction: "delivery", id: "stop-delivery" },
    line: {
      ...lines[0]!,
      role: "delivery",
    },
    isPickup: false,
    handledVerb: "dropped off",
    doneClass: "opacity-50",
    onToggleCargoHandled: () => undefined,
  },
};

export const TileRow: Story = {
  args: {
    row: pickupRow,
    line: lines[0]!,
    isPickup: true,
    handledVerb: "picked up",
    doneClass: "opacity-50",
  },
  render: () => (
    <div className="@container/cargo grid w-72 grid-cols-2 gap-2">
      {lines.map((line) => (
        <CargoCommodityTile
          key={line.commoditySlug}
          row={pickupRow}
          line={line}
          isPickup
          handledVerb="picked up"
          doneClass="opacity-50"
          onToggleCargoHandled={() => undefined}
        />
      ))}
    </div>
  ),
};

export const CollapsedCargoLines: Story = {
  args: {
    row: pickupRow,
    line: lines[0]!,
    isPickup: true,
    handledVerb: "picked up",
    doneClass: "opacity-50",
  },
  render: () => (
    <div className="w-56 rounded-rsi border border-rsi-border bg-rsi-bg-deep/35 px-2.5 py-1.5">
      <CollapsedMissionCargoLines
        row={pickupRow}
        items={lines}
        role="pickup"
        onToggleCargoHandled={() => undefined}
      />
    </div>
  ),
};
