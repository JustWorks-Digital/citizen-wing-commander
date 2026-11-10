import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ShipBayEndsFrame } from "./ShipBayEndsMarkers";

const meta = {
  title: "Ships/ShipBayEndsFrame",
  component: ShipBayEndsFrame,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Front / Rear rails around a cargo bay sketch (2D view). Default: Rear left, Front right. Upright rails offset for Bay N labels.",
      },
    },
  },
  args: {
    flipped: false,
    slant: "upright",
    compact: false,
    children: (
      <div className="flex h-24 w-48 items-center justify-center rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-muted">
        Bay
      </div>
    ),
  },
} satisfies Meta<typeof ShipBayEndsFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Flipped: Story = {
  args: { flipped: true },
};

export const IsoSlant: Story = {
  args: { slant: "iso" },
};

export const Compact: Story = {
  args: { compact: true },
};
