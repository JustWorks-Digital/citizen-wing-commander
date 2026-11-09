import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MissionCatalogSkeleton } from "./MissionCatalogSkeleton";

const meta = {
  title: "Catalog/MissionCatalogSkeleton",
  component: MissionCatalogSkeleton,
  parameters: { layout: "padded" },
} satisfies Meta<typeof MissionCatalogSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FewRows: Story = {
  args: { rows: 4 },
};
