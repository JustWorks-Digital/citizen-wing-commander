import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { CargoBayLayout } from "./CargoBayLayout";

const meta = {
  title: "Missions/CargoBayLayout",
  component: CargoBayLayout,
  parameters: {
    layout: "padded",
  },
  args: {
    rows: mockSessionChecklist.rows,
  },
} satisfies Meta<typeof CargoBayLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Narrow viewport: named cargo list (one line per commodity). */
export const MobileList: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
