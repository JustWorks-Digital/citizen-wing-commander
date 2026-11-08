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

/** Checklist row treatment: glyph + inline label. */
export const WithInlineLabel: Story = {
  args: { locationSlug: "everus-harbor" },
  render: (args) => (
    <div className="flex items-center gap-1.5 text-rsi-text-secondary">
      <OutdoorFreightIcon {...args} />
      <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em]">
        Outdoor freight
      </span>
    </div>
  ),
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
