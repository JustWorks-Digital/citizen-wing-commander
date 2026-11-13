import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MissionsCatalogView } from "./MissionsCatalogView";
import { sampleCatalogMissions } from "./missionCatalogFixtures";

const meta = {
  title: "Catalog/MissionsCatalogView",
  component: MissionsCatalogView,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Contracts catalog with filters, checkbox selection, and selection totals (Stops / Distance / SCU / Peak / aUEC / EXP) under the selected chip block.",
      },
    },
  },
  args: {
    initialMissions: sampleCatalogMissions,
    persistUrlState: false,
  },
} satisfies Meta<typeof MissionsCatalogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Table: Story = {};

export const Empty: Story = {
  args: { initialMissions: [] },
};

export const TargetSession: Story = {
  args: {
    showHeading: false,
    targetSessionId: "story-session",
  },
};
