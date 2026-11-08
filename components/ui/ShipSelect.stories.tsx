import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { ShipSelect } from "./ShipSelect";

const demoOptions = [
  {
    slug: "c2-hercules-starlifter",
    name: "C2 Hercules Starlifter",
    cargoScu: 696,
  },
  {
    slug: "constellation-mk-v-centaurus",
    name: "Constellation Mk V Centaurus",
    cargoScu: 240,
  },
];

const meta = {
  title: "Primitives/ShipSelect",
  component: ShipSelect,
  parameters: {
    layout: "padded",
  },
  args: {
    options: demoOptions,
    valueSlug: "c2-hercules-starlifter",
    onChange: () => {},
  },
} satisfies Meta<typeof ShipSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [slug, setSlug] = useState<string | null>(args.valueSlug);
    return <ShipSelect {...args} valueSlug={slug} onChange={setSlug} />;
  },
};

export const Empty: Story = {
  args: {
    options: [],
    valueSlug: null,
  },
};
