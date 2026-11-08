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
