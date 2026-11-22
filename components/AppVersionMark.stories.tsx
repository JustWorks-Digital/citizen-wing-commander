import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AppVersionMark } from "./AppVersionMark";

const meta = {
  title: "Layout/AppVersionMark",
  component: AppVersionMark,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Fixed bottom-right build SHA (baked at Next build from git / Railway). Compare local vs prod without opening Network.",
      },
    },
  },
} satisfies Meta<typeof AppVersionMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
