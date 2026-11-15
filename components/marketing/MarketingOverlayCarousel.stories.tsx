import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { slidesForFamily } from "@/lib/marketing/overlays";
import { MarketingOverlayCarousel } from "./MarketingOverlayCarousel";

const meta = {
  title: "Marketing/MarketingOverlayCarousel",
  component: MarketingOverlayCarousel,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof MarketingOverlayCarousel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Landscape16x9: Story = {
  args: {
    slides: slidesForFamily("landscape"),
    intervalMs: 5000,
  },
};

export const Square1x1: Story = {
  args: {
    slides: slidesForFamily("square"),
    intervalMs: 5000,
  },
};

export const Banner4x1: Story = {
  args: {
    slides: slidesForFamily("banner"),
    intervalMs: 5000,
  },
};
