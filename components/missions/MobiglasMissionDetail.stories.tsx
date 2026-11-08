import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { MobiglasMissionDetail } from "./MobiglasMissionDetail";

const demo = mockSessionChecklist.missions[0]!;

const meta = {
  title: "Missions/MobiglasMissionDetail",
  component: MobiglasMissionDetail,
  parameters: {
    layout: "padded",
  },
  args: {
    panel: demo.mobiglas,
    screenshots: demo.screenshots,
  },
} satisfies Meta<typeof MobiglasMissionDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
