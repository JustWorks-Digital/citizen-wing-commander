import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type ComponentProps } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { StopMissionBoxConfigModal } from "./StopMissionBoxConfigModal";

const mission = cargoBoxSplits.withDefaults(mockSessionChecklist.missions[0]!);

const multiCargoMission: SessionMission = cargoBoxSplits.withDefaults({
  ...mission,
  id: "multi-cargo",
  title: "Junior Rank - Small Cargo Haul",
  cargo: [
    { commodity: "Silicon", scu: 12 },
    { commodity: "Titanium", scu: 8 },
  ],
  cargoSummary: "12 SCU Silicon · 8 SCU Titanium",
  maxContainerScu: 4,
  scuBoxSplits: undefined,
  scuBoxSplitsAutoSelected: undefined,
  scuCargoBoxSplits: undefined,
  scuCargoBoxSplitsAutoSelected: undefined,
});

const meta = {
  title: "Missions/StopMissionBoxConfigModal",
  component: StopMissionBoxConfigModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Correct mission SCU, per-station collect/deliver SCU, and crate mixes (Pickup / Drop off double-click). Total dropdown applies a style to every cargo type; each commodity also has its own combination dropdown (`scuCargoBoxSplits`).",
      },
    },
  },
} satisfies Meta<typeof StopMissionBoxConfigModal>;

export default meta;
type Story = StoryObj<typeof meta>;

function InteractiveModal({
  args,
}: {
  args: ComponentProps<typeof StopMissionBoxConfigModal>;
}) {
  const [draft, setDraft] = useState(args.mission);
  return (
    <StopMissionBoxConfigModal
      {...args}
      mission={draft}
      onSelectBoxBreakdown={(commoditySlug, breakdown, options) => {
        setDraft((prev) => {
          let next = cargoBoxSplits.setCommodity(
            prev,
            commoditySlug,
            breakdown,
          );
          if (options?.applyPreferredMaxToRemaining) {
            next = cargoBoxSplits.propagatePreferredMax(next, commoditySlug, {
              onlyUncorrected: options.onlyUncorrected !== false,
            });
          }
          return next;
        });
        args.onSelectBoxBreakdown(commoditySlug, breakdown, options);
      }}
      onChangeCommodityScu={(commoditySlug, scu) => {
        setDraft((prev) => {
          const lines = cargoBoxSplits.commodityLines(prev);
          const match = lines.find(
            (entry) => entry.commoditySlug === commoditySlug,
          );
          if (!match) return prev;
          return {
            ...prev,
            cargo: prev.cargo.map((line) =>
              line.commodity === match.commodity ? { ...line, scu } : line,
            ),
            scuTotalCertainty: "known" as const,
          };
        });
        args.onChangeCommodityScu?.(commoditySlug, scu);
      }}
      onChangeStationScu={(input) => {
        setDraft((prev) => {
          const field = input.role === "pickup" ? "from" : "to";
          const splits = (prev.deliverySplits ?? []).map((split) => {
            const lines = cargoBoxSplits.commodityLines({
              ...prev,
              cargo: [{ commodity: split.commodity, scu: split.scu }],
            });
            if (lines[0]?.commoditySlug !== input.commoditySlug) return split;
            if (
              split[field].trim().toLowerCase() !==
              input.locationKey.trim().toLowerCase()
            ) {
              return split;
            }
            return { ...split, scu: input.scu };
          });
          return {
            ...prev,
            deliverySplits: splits,
            scuTotalCertainty: "known" as const,
          };
        });
        args.onChangeStationScu?.(input);
      }}
    />
  );
}

export const Default: Story = {
  args: {
    mission,
    onClose: () => {},
    onSelectBoxBreakdown: () => {},
    onChangeCommodityScu: () => {},
    onChangeStationScu: () => {},
  },
  render: (args) => <InteractiveModal args={args} />,
};

export const MultiCargo: Story = {
  args: {
    mission: multiCargoMission,
    onClose: () => {},
    onSelectBoxBreakdown: () => {},
    onChangeCommodityScu: () => {},
    onChangeStationScu: () => {},
  },
  render: (args) => <InteractiveModal args={args} />,
};

export const UserCorrected: Story = {
  args: {
    mission: cargoBoxSplits.setCommodity(
      cargoBoxSplits.withDefaults({
        ...mission,
        maxContainerScu: 4,
      }),
      cargoBoxSplits.commodityLines(mission)[0]?.commoditySlug ?? "scrap",
      {
        scuOne: 1,
        scuTwo: 2,
        scuFour: 5,
        scuEight: 0,
        scuSixteen: 0,
        scuThirtyTwo: 0,
      },
    ),
    onClose: () => {},
    onSelectBoxBreakdown: () => {},
  },
  render: (args) => <InteractiveModal args={args} />,
};
