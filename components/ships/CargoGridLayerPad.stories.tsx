import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import {
  CargoGridLayerPad,
  CargoGridLayerPadToggle,
} from "./CargoGridLayerPad";

function SelectDemo() {
  const [active, setActive] = useState(0);
  const [onGrid, setOnGrid] = useState(true);
  return (
    <div className="relative h-40 w-56 rounded-rsi border border-rsi-border bg-rsi-bg-deep/50 p-2">
      <CargoGridLayerPadToggle
        isOn={onGrid}
        onToggle={() => setOnGrid((value) => !value)}
      />
      {onGrid ? (
        <CargoGridLayerPad
          mode="select"
          layers={[0, 1, 2, 3]}
          activeLayer={active}
          onSelectLayer={setActive}
          ariaLabel="2D layers"
        />
      ) : null}
    </div>
  );
}

function ToggleDemo() {
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set());
  const [onGrid, setOnGrid] = useState(true);
  return (
    <div className="relative h-40 w-56 rounded-rsi border border-rsi-border bg-rsi-bg-deep/50 p-2">
      <CargoGridLayerPadToggle
        isOn={onGrid}
        onToggle={() => setOnGrid((value) => !value)}
      />
      {onGrid ? (
        <CargoGridLayerPad
          mode="toggle"
          layers={[0, 1, 2, 3]}
          hiddenLayers={hidden}
          onToggleLayer={(layer) => {
            setHidden((prev) => {
              const next = new Set(prev);
              if (next.has(layer)) next.delete(layer);
              else next.add(layer);
              return next;
            });
          }}
          ariaLabel="3D layers"
        />
      ) : null}
    </div>
  );
}

const meta = {
  title: "Ships/CargoGridLayerPad",
  component: CargoGridLayerPad,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Bottom-center Z-layer pad for 2D (select) and 3D (toggle). Legend “On grid” shows or hides the pad.",
      },
    },
  },
} satisfies Meta<typeof CargoGridLayerPad>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Select2D: Story = {
  args: {
    mode: "select",
    layers: [0, 1, 2, 3],
    activeLayer: 0,
  },
  render: () => <SelectDemo />,
};

export const Toggle3D: Story = {
  args: {
    mode: "toggle",
    layers: [0, 1, 2, 3],
  },
  render: () => <ToggleDemo />,
};
