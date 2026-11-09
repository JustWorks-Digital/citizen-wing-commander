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

/** Dual crate tint blended (gray + rust). */
export const Waste: Story = {
  args: {
    commoditySlug: "waste",
    label: "Waste",
    color: "gray",
    color2: "rust",
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

/** Kind crate tint as family base; per-slug uniquify keeps siblings distinct. */
export const DistinctSameKind: Story = {
  args: {
    showTooltip: false,
    size: "sm",
  },
  render: () => {
    const samples = [
      { slug: "aluminum", label: "Aluminum", color: "green", color2: "yellow" },
      { slug: "agricium", label: "Agricium", color: "green", color2: "yellow" },
      { slug: "borase", label: "Borase", color: "green", color2: "yellow" },
      { slug: "titanium", label: "Titanium", color: "green", color2: "yellow" },
      { slug: "tungsten", label: "Tungsten", color: "green", color2: "yellow" },
      { slug: "copper", label: "Copper", color: "green", color2: "yellow" },
      { slug: "beryl", label: "Beryl", color: "gray", color2: "yellow" },
      { slug: "scrap", label: "Scrap", color: "black", color2: "orange" },
    ] as const;
    return (
      <ul className="space-y-2">
        {samples.map((item) => (
          <li
            key={item.slug}
            className="flex items-center gap-2 text-xs text-rsi-text"
          >
            <CommodityIcon
              commoditySlug={item.slug}
              label={item.label}
              color={item.color}
              color2={item.color2}
              size="sm"
              showTooltip={false}
            />
            <span className="font-medium">{item.label}</span>
          </li>
        ))}
      </ul>
    );
  },
};
