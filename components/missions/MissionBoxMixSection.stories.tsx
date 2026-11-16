import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { MissionBoxMixSection } from "./MissionBoxMixSection";

const single = cargoBoxSplits.withDefaults(mockSessionChecklist.missions[0]!);
const multi: SessionMission = cargoBoxSplits.withDefaults({
  ...single,
  id: "multi-cargo",
  title: "Junior Rank - Small Cargo Haul",
  cargo: [
    { commodity: "Silicon", scu: 12 },
    { commodity: "Titanium", scu: 8 },
  ],
  cargoSummary: "12 SCU Silicon · 8 SCU Titanium",
  scuMaxContainerSize: 4,
  scuBoxSplits: undefined,
  scuBoxSplitsAutoSelected: undefined,
  scuCargoBoxSplits: undefined,
  scuCargoBoxSplitsAutoSelected: undefined,
});

const meta = {
  title: "Missions/MissionBoxMixSection",
  component: MissionBoxMixSection,
  parameters: { layout: "padded" },
} satisfies Meta<typeof MissionBoxMixSection>;

export default meta;
type Story = StoryObj<typeof meta>;

function Interactive({ mission }: { mission: SessionMission }) {
  const [draft, setDraft] = useState(mission);
  const ready = cargoBoxSplits.withDefaults(draft);
  const lines = cargoBoxSplits.commodityLines(ready);
  const primaryLine = lines[0];
  if (!primaryLine) return null;
  return (
    <div className="max-w-xl bg-rsi-surface p-4">
      <MissionBoxMixSection
        mission={ready}
        primaryLine={primaryLine}
        lines={lines}
        disabled={false}
        onSelectTotal={(breakdown) => {
          setDraft((prev) => {
            let next = cargoBoxSplits.setCommodity(
              prev,
              primaryLine.commoditySlug,
              breakdown,
            );
            next = cargoBoxSplits.propagatePreferredMax(
              next,
              primaryLine.commoditySlug,
              { onlyUncorrected: false },
            );
            return next;
          });
        }}
        onSelectCargo={(commoditySlug, breakdown) => {
          setDraft((prev) =>
            cargoBoxSplits.setCommodity(prev, commoditySlug, breakdown),
          );
        }}
      />
    </div>
  );
}

export const SingleCargo: Story = {
  args: {
    mission: single,
    primaryLine: cargoBoxSplits.commodityLines(single)[0]!,
    lines: cargoBoxSplits.commodityLines(single),
    disabled: false,
    onSelectTotal: () => {},
    onSelectCargo: () => {},
  },
  render: () => <Interactive mission={single} />,
};

export const MultiCargo: Story = {
  args: {
    mission: multi,
    primaryLine: cargoBoxSplits.commodityLines(multi)[0]!,
    lines: cargoBoxSplits.commodityLines(multi),
    disabled: false,
    onSelectTotal: () => {},
    onSelectCargo: () => {},
  },
  render: () => <Interactive mission={multi} />,
};
