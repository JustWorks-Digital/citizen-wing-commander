import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SessionCatalogMissionsPanel } from "./SessionCatalogMissionsPanel";

const meta = {
  title: "Missions/SessionCatalogMissionsPanel",
  component: SessionCatalogMissionsPanel,
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    sessionId: "story-session",
    sessionName: "Stanton haul",
    onClose: () => {},
  },
} satisfies Meta<typeof SessionCatalogMissionsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
