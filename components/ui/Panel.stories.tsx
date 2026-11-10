import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";
import { Panel } from "./Panel";

const meta = {
  title: "Primitives/Panel",
  component: Panel,
  args: {
    eyebrow: "Channel",
    title: "Fleet status",
    children: (
      <p className="text-sm leading-relaxed">
        Panels use Spectrum-like raised surfaces (`--rsi-surface`) with industrial borders.
      </p>
    ),
  },
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActions: Story = {
  args: {
    eyebrow: "Ops",
    title: "Contract board",
    children: (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed">
          Compose interactive content inside the panel body. Prefer tokenized controls.
        </p>
        <div className="flex gap-3">
          <Button>Accept</Button>
          <Button variant="secondary">Defer</Button>
        </div>
      </div>
    ),
  },
};
