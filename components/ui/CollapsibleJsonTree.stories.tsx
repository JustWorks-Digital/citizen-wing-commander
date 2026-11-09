import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { asJsonValue, CollapsibleJsonTree } from "./CollapsibleJsonTree";
import { sampleCatalogMissions } from "@/components/catalog/missionCatalogFixtures";

const meta = {
  title: "UI/CollapsibleJsonTree",
  component: CollapsibleJsonTree,
  parameters: { layout: "padded" },
  args: {
    value: asJsonValue(sampleCatalogMissions[0]),
  },
} satisfies Meta<typeof CollapsibleJsonTree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
