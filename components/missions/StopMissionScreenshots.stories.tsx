import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StopMissionScreenshots } from "./StopMissionScreenshots";

const meta = {
  title: "Missions/StopMissionScreenshots",
  component: StopMissionScreenshots,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof StopMissionScreenshots>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TextChips: Story = {
  args: {
    refs: [
      {
        logicalPath: "demo-batch/lorville-stims.png",
        filename: "lorville-stims.png",
        label: "lorville-stims",
        missionTitles: ["Junior Rank — Stims"],
        url: null,
      },
      {
        logicalPath: "demo-batch/everus-quartz.png",
        filename: "everus-quartz.png",
        label: "everus-quartz",
        missionTitles: ["Direct Medium Cargo Haul"],
        url: null,
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    refs: [],
  },
};
