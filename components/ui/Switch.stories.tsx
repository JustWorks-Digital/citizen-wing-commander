import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Switch } from "./Switch";

function SwitchDemo() {
  const [names, setNames] = useState(true);
  const [hologram, setHologram] = useState(false);
  return (
    <div className="w-48 space-y-1.5 rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 p-2">
      <Switch label="Cargo names" checked={names} onCheckedChange={setNames} />
      <Switch
        label="Show hologram"
        checked={hologram}
        onCheckedChange={setHologram}
      />
    </div>
  );
}

const meta = {
  title: "UI/Switch",
  component: Switch,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Label-left switch for legend settings (cargo names, on-grid pads, etc.).",
      },
    },
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Cargo names",
    checked: true,
    onCheckedChange: () => {},
  },
  render: () => <SwitchDemo />,
};

export const Off: Story = {
  args: {
    label: "On grid",
    checked: false,
    onCheckedChange: () => {},
  },
};
