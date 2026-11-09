import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AddCatalogMissionsToSessionModal } from "./AddCatalogMissionsToSessionModal";

const meta = {
  title: "Catalog/AddCatalogMissionsToSessionModal",
  component: AddCatalogMissionsToSessionModal,
  parameters: { layout: "fullscreen" },
  args: {
    catalogMissionIds: ["11111111-1111-4111-8111-111111111111"],
    onClose: () => {},
  },
} satisfies Meta<typeof AddCatalogMissionsToSessionModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Multiple: Story = {
  args: {
    catalogMissionIds: [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ],
  },
};
