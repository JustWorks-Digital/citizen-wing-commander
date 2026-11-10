import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SponsorPage from "./page";

const meta = {
  title: "Pages/Sponsor",
  component: SponsorPage,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story:
          "Stream overlay promo card. Open `/sponsor` fullscreen in the app to screenshot for OBS.",
      },
    },
  },
} satisfies Meta<typeof SponsorPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
