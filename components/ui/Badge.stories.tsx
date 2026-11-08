import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";

const meta = {
  title: "Primitives/Badge",
  component: Badge,
  args: {
    children: "Pickup",
    variant: "accent",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["neutral", "accent", "success", "warn"],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="accent">Pickup</Badge>
      <Badge variant="success">Delivery</Badge>
      <Badge variant="warn">Warn</Badge>
      <Badge variant="neutral">Neutral</Badge>
    </div>
  ),
};
