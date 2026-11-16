import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type ComponentProps } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import type { MissionScuDraft } from "@/lib/missions/missionScuAmounts";
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

const multiDeliveryMission: SessionMission = cargoBoxSplits.withDefaults({
  ...mission,
  id: "multi-delivery",
  title: "Processed Food — three drops",
  cargo: [{ commodity: "Processed Food", scu: 11 }],
  cargoSummary: "11 SCU Processed Food",
  from: ["Port Tressler"],
  to: ["Everus Harbor", "Baijini Point", "Area 18"],
  deliverySplits: [
    {
      from: "Port Tressler",
      to: "Everus Harbor",
      commodity: "Processed Food",
      scu: 4,
    },
    {
      from: "Port Tressler",
      to: "Baijini Point",
      commodity: "Processed Food",
      scu: 3,
    },
    {
      from: "Port Tressler",
      to: "Area 18",
      commodity: "Processed Food",
      scu: 4,
    },
  ],
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
          "Condensed cargo SCU with expandable nested delivery amounts. Edits stay in a draft until Save validates that delivery stops sum to each cargo total. Crate-mix dropdowns still apply immediately.",
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
      onSaveScuDraft={(scuDraft: MissionScuDraft) => {
        setDraft((prev) => {
          const bySlug = new Map(
            scuDraft.commodities.map((line) => [line.commoditySlug, line]),
          );
          const cargo = prev.cargo.map((line) => {
            const slug = line.commodity.trim().toLowerCase().replace(/\s+/g, "-");
            const match =
              bySlug.get(slug) ??
              scuDraft.commodities.find(
                (entry) =>
                  entry.commodity.toLowerCase() === line.commodity.toLowerCase(),
              );
            return match ? { ...line, scu: match.scu } : line;
          });
          const deliverySplits =
            prev.deliverySplits?.map((split) => {
              const match = scuDraft.deliveries.find(
                (entry) =>
                  entry.commodity.toLowerCase() ===
                    split.commodity.toLowerCase() &&
                  entry.locationKey.trim().toLowerCase() ===
                    split.to.trim().toLowerCase(),
              );
              return match ? { ...split, scu: match.scu } : split;
            }) ?? prev.deliverySplits;
          return {
            ...prev,
            cargo,
            deliverySplits,
            cargoSummary: cargo
              .filter((line) => line.scu > 0)
              .map((line) => `${line.scu} SCU ${line.commodity}`)
              .join(" · "),
            scuTotalCertainty: "known" as const,
          };
        });
        args.onSaveScuDraft?.(scuDraft);
      }}
    />
  );
}

export const Default: Story = {
  args: {
    mission,
    onClose: () => {},
    onSelectBoxBreakdown: () => {},
    onSaveScuDraft: () => {},
  },
  render: (args) => <InteractiveModal args={args} />,
};

export const MultiCargo: Story = {
  args: {
    mission: multiCargoMission,
    onClose: () => {},
    onSelectBoxBreakdown: () => {},
    onSaveScuDraft: () => {},
  },
  render: (args) => <InteractiveModal args={args} />,
};

export const NestedDeliveries: Story = {
  args: {
    mission: multiDeliveryMission,
    onClose: () => {},
    onSelectBoxBreakdown: () => {},
    onSaveScuDraft: () => {},
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
