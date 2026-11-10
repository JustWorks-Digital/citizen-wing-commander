import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import { MissionBoxBreakdownPicker } from "./MissionBoxBreakdownPicker";

const meta = {
  title: "Missions/MissionBoxBreakdownPicker",
  component: MissionBoxBreakdownPicker,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Compact box-mix picker. Marks auto-selected vs user-corrected (`scuBoxSplitsAutoSelected`).",
      },
    },
  },
  args: {
    totalScu: 24,
    maxContainerScu: 8,
    onSelect: () => {},
  },
} satisfies Meta<typeof MissionBoxBreakdownPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Compact one-line dropdown trigger; open to pick another mix. */
export const Default: Story = {};

export const Interactive: Story = {
  render: function InteractivePicker() {
    const [selected, setSelected] = useState<ScuBoxSplits | null>(null);
    const autoSelected: ScuBoxSplits = {
      scuOne: 0,
      scuTwo: 0,
      scuFour: 0,
      scuEight: 4,
    };
    return (
      <div className="max-w-md rounded-rsi border border-rsi-border bg-rsi-bg-deep/50 p-4">
        <MissionBoxBreakdownPicker
          totalScu={32}
          maxContainerScu={8}
          autoSelected={autoSelected}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    );
  },
};

export const Corrected: Story = {
  args: {
    totalScu: 25,
    maxContainerScu: 4,
    autoSelected: { scuOne: 1, scuTwo: 0, scuFour: 6, scuEight: 0 },
    selected: { scuOne: 1, scuTwo: 2, scuFour: 5, scuEight: 0 },
  },
};

export const MaxContainer2: Story = {
  args: {
    totalScu: 12,
    maxContainerScu: 2,
  },
};
