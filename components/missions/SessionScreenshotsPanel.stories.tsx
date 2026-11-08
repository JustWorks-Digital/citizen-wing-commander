import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SessionScreenshotsPanel } from "./SessionScreenshotsPanel";

const meta = {
  title: "Missions/SessionScreenshotsPanel",
  component: SessionScreenshotsPanel,
  parameters: {
    layout: "padded",
  },
  args: {
    sessionId: "story-session",
    initialScreenshots: [],
  },
} satisfies Meta<typeof SessionScreenshotsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithShots: Story = {
  args: {
    initialScreenshots: [
      {
        logicalPath: "story-session/contract-stims.png",
        filename: "contract-stims.png",
        bytes: 184_320,
        mtime: "2026-11-08T06:00:00.000Z",
        url: "https://placehold.co/640x360/1c2737/54adf7?text=Stims",
      },
      {
        logicalPath: "story-session/contract-tin.png",
        filename: "contract-tin.png",
        bytes: 201_100,
        mtime: "2026-11-08T06:01:00.000Z",
        url: "https://placehold.co/640x360/1c2737/3dbf8f?text=Tin",
      },
    ],
  },
};
