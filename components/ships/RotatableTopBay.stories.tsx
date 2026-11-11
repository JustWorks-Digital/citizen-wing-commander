import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RotatableTopBay } from "./RotatableTopBay";

const meta = {
  title: "Ships/RotatableTopBay",
  component: RotatableTopBay,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Square-rotates 2D bay content (90° snaps) and swaps the layout box on quarter turns.",
      },
    },
  },
  args: {
    degrees: 90,
    children: (
      <div className="flex h-24 w-40 items-center justify-center rounded-rsi border border-rsi-border bg-rsi-surface font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-muted">
        Bay · rear left
      </div>
    ),
  },
} satisfies Meta<typeof RotatableTopBay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const QuarterTurn: Story = {};

export const HalfTurn: Story = {
  args: { degrees: 180 },
};
