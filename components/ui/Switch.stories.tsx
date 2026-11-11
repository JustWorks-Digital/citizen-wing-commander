import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Switch } from "./Switch";

function SwitchDemo() {
  const [on, setOn] = useState(true);
  return (
    <div className="w-48 rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 p-2">
      <Switch label="Cargo names" checked={on} onCheckedChange={setOn} />
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
