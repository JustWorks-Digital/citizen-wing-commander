import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { CargoLegendSection } from "./CargoLegendSection";

const meta = {
  title: "Ships/CargoLegendSection",
  component: CargoLegendSection,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Expand/collapse header for a cargo bay legend block (locations, cargo, SCU sizes, layers).",
      },
    },
  },
} satisfies Meta<typeof CargoLegendSection>;

export default meta;
type Story = StoryObj<typeof meta>;

function InteractiveDemo() {
  const [open, setOpen] = useState(true);
  return (
    <div className="w-64 rounded-rsi border border-rsi-border bg-rsi-bg-deep/95 px-2 py-1.5">
      <CargoLegendSection
        title="SCU sizes"
        sectionId="scu-sizes"
        isExpanded={open}
        onToggle={() => setOpen((value) => !value)}
      >
        <p className="font-mono text-[0.65rem] text-rsi-text-secondary">
          1 · 2 · 4 · 8
        </p>
      </CargoLegendSection>
      <CargoLegendSection
        title="Layers"
        sectionId="layers"
        isExpanded={!open}
        onToggle={() => setOpen((value) => !value)}
        showBorder
      >
        <p className="font-mono text-[0.65rem] text-rsi-text-secondary">
          Layer toggles
        </p>
      </CargoLegendSection>
    </div>
  );
}

export const Default: Story = {
  args: {
    title: "Cargo",
    sectionId: "cargo",
    isExpanded: true,
    onToggle: () => {},
    children: (
      <p className="font-mono text-[0.65rem] text-rsi-text-secondary">
        Section body
      </p>
    ),
  },
};

export const Interactive: Story = {
  args: {
    title: "SCU sizes",
    sectionId: "scu-sizes",
    isExpanded: true,
    onToggle: () => {},
    children: null,
  },
  render: () => <InteractiveDemo />,
};
