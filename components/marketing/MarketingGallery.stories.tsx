import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MarketingGallery } from "./MarketingGallery";

const meta = {
  title: "Marketing/MarketingGallery",
  component: MarketingGallery,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof MarketingGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHint: Story = {
  name: "Click thumbnail or Browse all for slideshow",
};
