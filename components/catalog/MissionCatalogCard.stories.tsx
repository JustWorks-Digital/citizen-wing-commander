import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MissionCatalogCard } from "./MissionCatalogCard";
import { sampleCatalogMissions } from "./missionCatalogFixtures";

const meta = {
  title: "Catalog/MissionCatalogCard",
  component: MissionCatalogCard,
  args: {
    mission: sampleCatalogMissions[0]!,
    onSelect: () => {},
    onViewSource: () => {},
  },
} satisfies Meta<typeof MissionCatalogCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = {
  args: { isSelected: true },
};

export const WithoutSource: Story = {
  args: { mission: sampleCatalogMissions[1]! },
};
