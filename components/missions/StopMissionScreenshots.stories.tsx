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

export const SourceButton: Story = {
  args: {
    refs: [
      {
        logicalPath: "demo/lorville-a.png",
        filename: "lorville-a.png",
        label: "lorville-a",
        missionTitles: ["Member Rank — Corundum"],
        url: "/images/outdoor-freight-elevators/port-tressler.jpg",
      },
      {
        logicalPath: "demo/lorville-b.png",
        filename: "lorville-b.png",
        label: "lorville-b",
        missionTitles: ["Member Rank — Quartz"],
        url: "/images/outdoor-freight-elevators/port-tressler.jpg",
      },
      {
        logicalPath: "demo/lorville-c.png",
        filename: "lorville-c.png",
        label: "lorville-c",
        missionTitles: ["Member Rank — Tin"],
        url: "/images/outdoor-freight-elevators/port-tressler.jpg",
      },
    ],
  },
};

export const TextOnlyPaths: Story = {
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
