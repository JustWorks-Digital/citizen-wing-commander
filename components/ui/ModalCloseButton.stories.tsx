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
          "Dismiss X as a rounded box above the modal top edge, right edge flush with the panel. Use placement=inline in toolbars.",
      },
    },
  },
} satisfies Meta<typeof ModalCloseButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="pt-12">
      <div className="relative h-24 w-64 rounded-rsi border border-rsi-border bg-rsi-surface p-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-accent">
          Modal header
        </p>
        <p className="mt-2 text-sm text-rsi-text-secondary">
          Full-width copy — X sits above, flush right.
        </p>
        <ModalCloseButton />
      </div>
    </div>
  ),
};

export const InlineToolbar: Story = {
  render: () => (
    <div className="flex h-14 w-80 items-center gap-3 rounded-rsi border border-rsi-border bg-rsi-surface px-4">
      <p className="min-w-0 flex-1 truncate font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted">
        Preview
      </p>
      <ModalCloseButton placement="inline" />
    </div>
  ),
};
