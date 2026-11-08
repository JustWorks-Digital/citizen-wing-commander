import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CommodityIcon } from "./CommodityIcon";

const meta = {
  title: "Missions/CommodityIcon",
  component: CommodityIcon,
  parameters: {
    layout: "centered",
  },
  args: {
    commoditySlug: "aluminum",
    label: "Aluminum",
    color: "green",
    color2: "yellow",
    size: "md",
    tooltipDelayMs: 450,
  },
} satisfies Meta<typeof CommodityIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Food: Story = {
  args: {
    commoditySlug: "processed-food",
    label: "Processed Food",
    color: "white",
    color2: "gray",
  },
};

/** Label shown beside the icon (mobile cargo bay list). */
export const InlineLabel: Story = {
  args: {
    showTooltip: false,
    label: "12 SCU · Aluminum",
    size: "sm",
  },
  render: (args) => (
    <div className="flex items-center gap-1.5 text-xs text-rsi-text">
      <CommodityIcon {...args} />
      <span className="font-medium">{args.label}</span>
    </div>
  ),
};
