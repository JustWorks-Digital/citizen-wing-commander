import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  c2HerculesCargoGridSketch,
  mkVCentaurusCargoGridSketch,
} from "@/lib/ships/cargoGrids";
import { CargoGridSketch } from "./CargoGridSketch";

const meta = {
  title: "Ships/CargoGridSketch",
  component: CargoGridSketch,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Ship bay 2D / 3D views with Front/Rear rails (rear left, front right). Legend toggles hide inactive cargo types completely.",
      },
    },
  },
  args: {
    sketch: c2HerculesCargoGridSketch,
    cellPx: 18,
    selectedCoord: null,
  },
} satisfies Meta<typeof CargoGridSketch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const C2Hercules: Story = {};

export const MkVCentaurus: Story = {
  args: {
    sketch: mkVCentaurusCargoGridSketch,
    cellPx: 36,
    isoCellPx: 16,
  },
};

export const LargerCells: Story = {
  args: { cellPx: 24, isoCellPx: 14 },
};

export const WithSelectedCell: Story = {
  args: {
    selectedCoord: { x: 2, y: 3, z: 1 },
  },
};
