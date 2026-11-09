import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MissionCatalogJsonModal } from "./MissionCatalogJsonModal";
import { sampleCatalogMissions } from "./missionCatalogFixtures";

const meta = {
  title: "Catalog/MissionCatalogJsonModal",
  component: MissionCatalogJsonModal,
  parameters: { layout: "fullscreen" },
  args: {
    mission: sampleCatalogMissions[0]!,
    onClose: () => {},
  },
} satisfies Meta<typeof MissionCatalogJsonModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
