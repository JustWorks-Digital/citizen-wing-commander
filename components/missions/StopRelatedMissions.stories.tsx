import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { StopRelatedMissions } from "./StopRelatedMissions";

const row =
  mockSessionChecklist.rows.find((entry) => entry.legKind === "pickup") ??
  mockSessionChecklist.rows[0]!;

const meta = {
  title: "Missions/StopRelatedMissions",
  component: StopRelatedMissions,
  parameters: { layout: "padded" },
  args: {
    row,
    missions: mockSessionChecklist.missions,
    onSelectBoxBreakdown: () => {},
  },
} satisfies Meta<typeof StopRelatedMissions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithInlineSource: Story = {
  args: {
    screenshotRefs: [
      {
        logicalPath: "demo/everus-pickup.png",
        filename: "everus-pickup.png",
        label: "everus-pickup",
        missionTitles: ["Member Rank — Corundum"],
        url: "/images/outdoor-freight-elevators/port-tressler.jpg",
      },
    ],
  },
};

export const Empty: Story = {
  args: { missions: [] },
};
