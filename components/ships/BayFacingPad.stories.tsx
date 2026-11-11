import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import {
  BayFacingPad,
  defaultBayFacing,
  type BayFacing,
} from "./BayFacingPad";

function PadDemo() {
  const [facing, setFacing] = useState<BayFacing>(defaultBayFacing);
  return (
    <div className="relative h-40 w-56 rounded-rsi border border-rsi-border bg-rsi-bg-deep/50">
      <BayFacingPad facing={facing} onFacingChange={setFacing} />
      <p className="absolute top-2 right-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-muted">
        {facing}
      </p>
    </div>
  );
}

const meta = {
  title: "Ships/BayFacingPad",
  component: BayFacingPad,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Compass pad for bay orientation. 2D uses square 90° snaps; 3D uses the same control for iso facings.",
      },
    },
  },
} satisfies Meta<typeof BayFacingPad>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    facing: defaultBayFacing,
    onFacingChange: () => {},
  },
  render: () => <PadDemo />,
};
