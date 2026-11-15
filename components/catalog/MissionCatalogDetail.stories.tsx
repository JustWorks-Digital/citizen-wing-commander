import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MissionCatalogDetail } from "./MissionCatalogDetail";
import { sampleCatalogMissions } from "./missionCatalogFixtures";

const meta = {
  title: "Catalog/MissionCatalogDetail",
  component: MissionCatalogDetail,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Contract detail modal — From/To/Cargo use the same short-name and colored badges as the catalog table; box mix is labeled Boxes.",
      },
    },
  },
  args: {
    mission: sampleCatalogMissions[0]!,
    onClose: () => {},
    onViewSource: () => {},
  },
} satisfies Meta<typeof MissionCatalogDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutSource: Story = {
  args: { mission: sampleCatalogMissions[1]! },
};
