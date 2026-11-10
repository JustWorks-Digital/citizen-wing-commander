"use client";

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EditableZoomPercent } from "./EditableZoomPercent";

function EditableZoomPercentDemo({
  initialZoom = 1,
  min = 0.5,
  max = 2.5,
}: {
  initialZoom?: number;
  min?: number;
  max?: number;
}) {
  const [zoom, setZoom] = useState(initialZoom);
  return (
    <div className="inline-flex overflow-hidden rounded-rsi border border-rsi-border bg-rsi-bg-deep/70">
      <EditableZoomPercent
        zoom={zoom}
        min={min}
        max={max}
        onChange={setZoom}
        onClick={() => setZoom(1)}
        className="inline-flex min-w-[2.75rem] items-center justify-center px-1.5 font-mono text-[0.6rem] tabular-nums text-rsi-text-secondary transition-colors hover:text-rsi-text"
        title="Click to reset · double-click to set"
        aria-label="Reset zoom"
      />
    </div>
  );
}

const meta = {
  title: "Primitives/EditableZoomPercent",
  component: EditableZoomPercentDemo,
  parameters: {
    docs: {
      description: {
        component:
          "Zoom percent control: single-click resets, double-click types a custom %.",
      },
    },
  },
} satisfies Meta<typeof EditableZoomPercentDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AtMin: Story = {
  args: { initialZoom: 0.5 },
};

export const AtMax: Story = {
  args: { initialZoom: 2.5 },
};
