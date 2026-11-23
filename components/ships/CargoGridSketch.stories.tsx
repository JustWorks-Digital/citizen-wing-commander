import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  c2HerculesCargoGridSketch,
  galaxyCargoGridSketch,
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
          "Ship bay 2D / 3D views with Front/Rear rails (rear left, front right). Split stacks 2D above 3D on mobile and side-by-side from sm+. 2D uses square facing snaps; 3D keeps iso facings. Zoom is independent per pane. Legend toggles hide inactive cargo types completely. Manual edit: crates sit above cell selection so Door/Lift Gap chrome cannot steal grabs; click a crate to select it, then R or the rotate control to cycle orientations (2/16/32 SCU); stacked crates show a bottom-right badge — drag that badge to move the whole stack. Split: click a 3D crate to focus it on 2D (auto Z layer + accent ring) so you can drag it in Manual. 2D active layer shows ghost underlays for crates entirely below that Z; crate fill opacity tracks free stack room (solid = cannot fit on top, fainter = more layers free).",
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

export const Galaxy: Story = {
  args: {
    sketch: galaxyCargoGridSketch,
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
