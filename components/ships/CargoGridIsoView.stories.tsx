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
