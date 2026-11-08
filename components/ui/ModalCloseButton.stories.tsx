import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ModalCloseButton } from "./ModalCloseButton";

const meta = {
  title: "Primitives/ModalCloseButton",
  component: ModalCloseButton,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Top-right X dismiss control for modals and lightbox overlays.",
      },
    },
  },
} satisfies Meta<typeof ModalCloseButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="relative h-24 w-64 rounded-rsi border border-rsi-border bg-rsi-surface p-4">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-accent">
        Modal header
      </p>
      <ModalCloseButton />
    </div>
  ),
};
