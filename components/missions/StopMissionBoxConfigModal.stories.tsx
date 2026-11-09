import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import { StopMissionBoxConfigModal } from "./StopMissionBoxConfigModal";

const mission = mockSessionChecklist.missions[0]!;

const meta = {
  title: "Missions/StopMissionBoxConfigModal",
  component: StopMissionBoxConfigModal,
  parameters: { layout: "fullscreen" },
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
        mission={{ ...args.mission, scuBoxSplits: splits ?? undefined }}
        onSelectBoxBreakdown={(breakdown) => {
          setSplits(breakdown);
          args.onSelectBoxBreakdown(breakdown);
        }}
      />
    );
  },
};
