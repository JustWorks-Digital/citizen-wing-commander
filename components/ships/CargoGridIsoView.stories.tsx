import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  c2HerculesCargoGridSketch,
  mkVCentaurusCargoGridSketch,
} from "@/lib/ships/cargoGrids";
import { CargoGridIsoView } from "./CargoGridIsoView";

const meta = {
  title: "Ships/CargoGridIsoView",
  component: CargoGridIsoView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Isometric bay view with Front/Rear outside the bay end edges, text parallel to those edges. Commodity legend shows box count in parentheses after the name.",
      },
    },
  },
  args: {
    sketch: c2HerculesCargoGridSketch,
    cellPx: 12,
    selectedCoord: null,
  },
} satisfies Meta<typeof CargoGridIsoView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const C2Hercules: Story = {};

export const MkVCentaurus: Story = {
  args: {
    sketch: mkVCentaurusCargoGridSketch,
    cellPx: 16,
  },
};

export const WithSelectedCell: Story = {
  args: {
    selectedCoord: { x: 10, y: 2, z: 2 },
  },
};

export const PlacementOnly: Story = {
  args: {
    mode: "placement",
    showFacingPad: true,
    highlightedCoords: [
      { x: 1, y: 2, z: 0 },
      { x: 2, y: 2, z: 0 },
      { x: 1, y: 3, z: 0 },
      { x: 2, y: 3, z: 0 },
      { x: 1, y: 2, z: 1 },
      { x: 2, y: 2, z: 1 },
      { x: 1, y: 3, z: 1 },
      { x: 2, y: 3, z: 1 },
      { x: 3, y: 2, z: 0 },
      { x: 4, y: 2, z: 0 },
      { x: 3, y: 3, z: 0 },
      { x: 4, y: 3, z: 0 },
    ],
  },
};

/** Debug crate silhouettes (legend → Debugging → Box outlines). */
export const DebugBoxOutlines: Story = {
  args: {
    sketch: mkVCentaurusCargoGridSketch,
    mode: "placement",
    showFacingPad: true,
    debugBoxOutlines: true,
    placementBoxes: [
      {
        id: "debug-8",
        size: 8,
        origin: { x: 0, y: 0, z: 0 },
        footprint: { dx: 2, dy: 2, dz: 2 },
        commoditySlug: "tin",
        commodityName: "Tin",
        color: "#8a9bb0",
        color2: null,
        cells: [],
        action: "pickup",
      },
      {
        id: "debug-4",
        size: 4,
        origin: { x: 2, y: 0, z: 0 },
        footprint: { dx: 2, dy: 2, dz: 1 },
        commoditySlug: "aluminum",
        commodityName: "Aluminum",
        color: "#b0b0b0",
        color2: null,
        cells: [],
        action: "pickup",
      },
    ],
  },
};

/** Parent passes already location-filtered boxes; empty = no crates. */
export const EmptyAfterLocationFilter: Story = {
  args: {
    sketch: mkVCentaurusCargoGridSketch,
    mode: "placement",
    showFacingPad: true,
    placementBoxes: [],
    locationLegendItems: [
      {
        locationSlug: "hdpc-cassillo",
        locationName: "HDPC-Cassillo",
        groupIndex: 1,
        scu: 33,
        stroke: "#54a0f7",
      },
      {
        locationSlug: "lorville",
        locationName: "Lorville",
        groupIndex: 2,
        scu: 42,
        stroke: "#e85d5d",
      },
    ],
    hiddenLocations: new Set(["hdpc-cassillo", "lorville"]),
  },
};
