import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Spinner } from "./Spinner";

const meta = {
  title: "Primitives/Spinner",
  component: Spinner,
  parameters: { layout: "padded" },
  args: {
    className: "size-5 text-rsi-accent",
  },
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  args: {
    label: "Saving",
    className: "size-4 text-rsi-accent",
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-rsi-accent">
      <Spinner className="size-3.5" />
      <Spinner className="size-4" />
      <Spinner className="size-5" />
      <Spinner className="size-8" />
    </div>
  ),
};
