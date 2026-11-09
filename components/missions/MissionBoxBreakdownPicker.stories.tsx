import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import { MissionBoxBreakdownPicker } from "./MissionBoxBreakdownPicker";

const meta = {
  title: "Missions/MissionBoxBreakdownPicker",
  component: MissionBoxBreakdownPicker,
  parameters: {
    layout: "padded",
  },
  args: {
    totalScu: 24,
    maxContainerScu: 8,
    onSelect: () => {},
  },
} satisfies Meta<typeof MissionBoxBreakdownPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Interactive: Story = {
  render: function InteractivePicker() {
    const [selected, setSelected] = useState<ScuBoxSplits | null>(null);
    return (
      <div className="max-w-xl rounded-rsi border border-rsi-border bg-rsi-bg-deep/50 p-4">
        <MissionBoxBreakdownPicker
          totalScu={32}
          maxContainerScu={8}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    );
  },
};

export const MaxContainer2: Story = {
  args: {
    totalScu: 12,
    maxContainerScu: 2,
  },
};
