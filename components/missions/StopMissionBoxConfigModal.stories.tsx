import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import { StopMissionBoxConfigModal } from "./StopMissionBoxConfigModal";

const mission = mockSessionChecklist.missions[0]!;

const meta = {
  title: "Missions/StopMissionBoxConfigModal",
  component: StopMissionBoxConfigModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Correct crate mixes for a session contract. Shows auto-selected vs user-selected (`scuBoxSplitsAutoSelected` vs `scuBoxSplits`).",
      },
    },
  },
} satisfies Meta<typeof StopMissionBoxConfigModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    mission,
    onClose: () => {},
    onSelectBoxBreakdown: () => {},
  },
  render: function Render(args) {
    const [splits, setSplits] = useState<ScuBoxSplits | null>(
      args.mission.scuBoxSplits ?? null,
    );
    return (
      <StopMissionBoxConfigModal
        {...args}
        mission={{
          ...args.mission,
          scuBoxSplitsAutoSelected:
            args.mission.scuBoxSplitsAutoSelected ??
            args.mission.scuBoxSplits ??
            undefined,
          scuBoxSplits: splits ?? undefined,
        }}
        onSelectBoxBreakdown={(breakdown) => {
          setSplits(breakdown);
          args.onSelectBoxBreakdown(breakdown);
        }}
      />
    );
  },
};

export const UserCorrected: Story = {
  args: {
    mission: {
      ...mission,
      maxContainerScu: 4,
      scuBoxSplitsAutoSelected: {
        scuOne: 1,
        scuTwo: 0,
        scuFour: 6,
        scuEight: 0,
      },
      scuBoxSplits: { scuOne: 1, scuTwo: 2, scuFour: 5, scuEight: 0 },
    },
    onClose: () => {},
    onSelectBoxBreakdown: () => {},
  },
};
