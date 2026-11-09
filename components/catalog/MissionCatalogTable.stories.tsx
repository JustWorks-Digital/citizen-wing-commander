import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MissionCatalogTable } from "./MissionCatalogTable";
import { sampleCatalogMissions } from "./missionCatalogFixtures";

const meta = {
  title: "Catalog/MissionCatalogTable",
  component: MissionCatalogTable,
  parameters: { layout: "padded" },
  args: {
    missions: sampleCatalogMissions,
    selectedId: null,
    onSelect: () => {},
    onViewSource: () => {},
    onViewObject: () => {},
  },
} satisfies Meta<typeof MissionCatalogTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SelectedRow: Story = {
  args: { selectedId: sampleCatalogMissions[0]!.id },
};

export const Empty: Story = {
  args: { missions: [] },
};
