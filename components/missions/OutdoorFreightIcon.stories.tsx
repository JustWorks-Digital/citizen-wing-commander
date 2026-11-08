import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { OutdoorFreightIcon } from "./OutdoorFreightIcon";

const meta = {
  title: "Missions/OutdoorFreightIcon",
  component: OutdoorFreightIcon,
  parameters: {
    layout: "centered",
  },
  args: {
    tooltipDelayMs: 200,
    size: "sm",
    locationSlug: "baijini-point",
  },
} satisfies Meta<typeof OutdoorFreightIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BaijiniPoint: Story = {
  args: { locationSlug: "baijini-point" },
};

export const BadgeSize: Story = {
  args: { size: "xs", locationSlug: "everus-harbor" },
};

export const PortTressler: Story = {
  args: { locationSlug: "port-tressler" },
};

export const SeraphimStation: Story = {
  args: { locationSlug: "seraphim-station" },
};

/** Large glyph for design review — tell the agent what to fix from this view. */
export const Preview: Story = {
  args: { size: "preview", locationSlug: "baijini-point" },
};
