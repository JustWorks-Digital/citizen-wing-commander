import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  CargoBoxCountIcons,
  CargoBoxSizeIcon,
} from "@/components/ships/CargoBoxSizeIcon";

const meta = {
  title: "Ships/CargoBoxSizeIcon",
  component: CargoBoxSizeIcon,
  parameters: { layout: "centered" },
} satisfies Meta<typeof CargoBoxSizeIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sizes: Story = {
  args: { size: 8, color: "#6b8cae" },
  render: () => (
    <div className="flex items-end gap-3 rounded-rsi border border-rsi-border bg-rsi-bg-deep p-4">
      {([8, 4, 2, 1] as const).map((size) => (
        <div key={size} className="flex flex-col items-center gap-1">
          <CargoBoxSizeIcon size={size} color="#6b8cae" className="size-6" />
          <span className="font-mono text-[0.6rem] text-rsi-text-muted">
            {size} SCU
          </span>
        </div>
      ))}
    </div>
  ),
};

export const CountBreakdown: Story = {
  args: { size: 8 },
  render: () => (
    <div className="rounded-rsi border border-rsi-border bg-rsi-bg-deep px-3 py-2">
      <CargoBoxCountIcons
        color="#9aa7b8"
        boxCounts={[
          { size: 8, count: 12 },
          { size: 4, count: 1 },
          { size: 1, count: 2 },
        ]}
      />
    </div>
  ),
};

