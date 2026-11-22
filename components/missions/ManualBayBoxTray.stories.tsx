import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ManualBayBoxTray,
  ManualBayPlacedBoxDragGhost,
  ManualBayTrayBulkDragGhost,
  ManualBayTrayDragGhost,
} from "./ManualBayBoxTray";
import type { ManualBayInventoryMissionGroup } from "@/lib/ships/manualBayInventory";

const groups: ManualBayInventoryMissionGroup[] = [
  {
    missionId: "mission-a",
    missionTitle: "Senior Medium Cargo Haul A",
    lines: [
      {
        key: "mission-a:processed-food:8",
        missionId: "mission-a",
        missionTitle: "Senior Medium Cargo Haul A",
        commoditySlug: "processed-food",
        commodityName: "Processed Food",
        size: 8,
        color: "red",
        color2: null,
        demanded: 4,
        placed: 1,
        remaining: 3,
      },
      {
        key: "mission-a:processed-food:2",
        missionId: "mission-a",
        missionTitle: "Senior Medium Cargo Haul A",
        commoditySlug: "processed-food",
        commodityName: "Processed Food",
        size: 2,
        color: "red",
        color2: null,
        demanded: 2,
        placed: 0,
        remaining: 2,
      },
      {
        key: "mission-a:hydrogen-fuel:8",
        missionId: "mission-a",
        missionTitle: "Senior Medium Cargo Haul A",
        commoditySlug: "hydrogen-fuel",
        commodityName: "Hydrogen Fuel",
        size: 8,
        color: "white",
        color2: null,
        demanded: 2,
        placed: 2,
        remaining: 0,
      },
    ],
  },
  {
    missionId: "mission-b",
    missionTitle: "Senior Medium Cargo Haul B",
    lines: [
      {
        key: "mission-b:processed-food:8",
        missionId: "mission-b",
        missionTitle: "Senior Medium Cargo Haul B",
        commoditySlug: "processed-food",
        commodityName: "Processed Food",
        size: 8,
        color: "red",
        color2: null,
        demanded: 2,
        placed: 0,
        remaining: 2,
      },
    ],
  },
];

const meta = {
  title: "Missions/ManualBayBoxTray",
  component: ManualBayBoxTray,
  parameters: {
    docs: {
      description: {
        component:
          "Manual Cargo panel: Fill rows stay after placing; Reset pulls that cargo type off the bay. Chevron expands size chips. R rotates; Esc cancels.",
      },
    },
  },
} satisfies Meta<typeof ManualBayBoxTray>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoMissions: Story = {
  args: {
    groups,
    onClearBay: () => undefined,
    onResetCommodity: () => undefined,
  },
};

/** Placed Fill row keeps its block with Reset (no more “0 left” placeholder). */
export const FillWithReset: Story = {
  args: {
    groups: [
      {
        missionId: "mission-a",
        missionTitle: "Senior Medium Cargo Haul A",
        lines: [
          {
            key: "mission-a:processed-food:8",
            missionId: "mission-a",
            missionTitle: "Senior Medium Cargo Haul A",
            commoditySlug: "processed-food",
            commodityName: "Processed Food",
            size: 8,
            color: "red",
            color2: null,
            demanded: 4,
            placed: 4,
            remaining: 0,
          },
          {
            key: "mission-a:hydrogen-fuel:8",
            missionId: "mission-a",
            missionTitle: "Senior Medium Cargo Haul A",
            commoditySlug: "hydrogen-fuel",
            commodityName: "Hydrogen Fuel",
            size: 8,
            color: "white",
            color2: null,
            demanded: 2,
            placed: 0,
            remaining: 2,
          },
        ],
      },
      groups[1]!,
    ],
    onClearBay: () => undefined,
    onResetCommodity: () => undefined,
  },
};

export const Dragging: Story = {
  args: {
    groups,
    onClearBay: () => undefined,
    draggingLineKey: "mission-a:processed-food:8",
    orientationIndex: 0,
  },
  render: (args) => (
    <div className="relative min-h-[16rem]">
      <p className="mb-2 text-[0.65rem] text-rsi-text-muted">
        Expand Sizes on Processed Food to drag individual chips.
      </p>
      <ManualBayBoxTray {...args} />
      <ManualBayTrayDragGhost
        spec={{
          size: 8,
          commoditySlug: "processed-food",
          commodityName: "Processed Food",
          color: "red",
          color2: null,
          missionId: "mission-a",
          action: "pickup",
        }}
        orientationIndex={0}
        clientX={220}
        clientY={120}
      />
    </div>
  ),
};

export const BulkFillDragging: Story = {
  args: {
    groups,
    onClearBay: () => undefined,
    draggingLineKey: "mission-a:processed-food:bulk",
  },
  render: (args) => (
    <div className="relative min-h-[16rem]">
      <ManualBayBoxTray {...args} />
      <ManualBayTrayBulkDragGhost
        fill={{
          missionId: "mission-a",
          commoditySlug: "processed-food",
          commodityName: "Processed Food",
          color: "red",
          color2: null,
          crates: [
            { size: 8, count: 3 },
            { size: 2, count: 2 },
          ],
        }}
        remainingScu={28}
        clientX={240}
        clientY={130}
      />
    </div>
  ),
};

export const PlacedCrateCursorGhost: Story = {
  args: {
    groups,
  },
  render: () => (
    <div className="relative min-h-[12rem] rounded-rsi border border-rsi-border bg-rsi-bg-deep/40">
      <p className="p-3 text-sm text-rsi-text-muted">
        Placed-crate drag ghost follows the pointer across gaps; drop on an
        invalid cell reverts.
      </p>
      <ManualBayPlacedBoxDragGhost
        box={{
          id: "demo-crate",
          size: 4,
          origin: { x: 0, y: 0, z: 0 },
          footprint: { dx: 2, dy: 2, dz: 1 },
          commoditySlug: "processed-food",
          commodityName: "Processed Food",
          color: "red",
          color2: null,
          cells: [],
          action: "pickup",
        }}
        clientX={180}
        clientY={100}
      />
    </div>
  ),
};
