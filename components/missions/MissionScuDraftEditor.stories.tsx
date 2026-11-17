import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useMemo, useState } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import {
  missionScuAmounts,
  type MissionScuDraft,
} from "@/lib/missions/missionScuAmounts";
import { MissionScuDraftEditor } from "./MissionScuDraftEditor";

const mission = mockSessionChecklist.missions[0]!;
const nestedMission = {
  ...mission,
  id: "nested-deliveries",
  cargo: [{ commodity: "Processed Food", scu: 11 }],
  cargoSummary: "11 SCU Processed Food",
  from: ["Port Tressler"],
  to: ["Everus Harbor", "Baijini Point", "Area 18"],
  scuSplits: [
    {
      kind: "deliver" as const,
      fromLocationSlug: "port-tressler",
      toLocationSlug: "everus-harbor",
      commoditySlug: "processed-food",
      commodityName: "Processed Food",
      scu: 4,
    },
    {
      kind: "deliver" as const,
      fromLocationSlug: "port-tressler",
      toLocationSlug: "baijini-point",
      commoditySlug: "processed-food",
      commodityName: "Processed Food",
      scu: 3,
    },
    {
      kind: "deliver" as const,
      fromLocationSlug: "port-tressler",
      toLocationSlug: "area-18",
      commoditySlug: "processed-food",
      commodityName: "Processed Food",
      scu: 4,
    },
  ],
};

const meta = {
  title: "Missions/MissionScuDraftEditor",
  component: MissionScuDraftEditor,
  parameters: { layout: "padded" },
} satisfies Meta<typeof MissionScuDraftEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

function Interactive({
  source,
}: {
  source: typeof mission | typeof nestedMission;
}) {
  const baseline = useMemo(
    () => missionScuAmounts.draftFromMission(source, null),
    [source],
  );
  const [draft, setDraft] = useState<MissionScuDraft>(baseline);
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(
    () => new Set(baseline.commodities.map((line) => line.commoditySlug)),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const lines = draft.commodities.map((line) => ({
    commoditySlug: line.commoditySlug,
    commodity: line.commodity,
    scu: line.scu,
  }));

  return (
    <div className="max-w-xl bg-rsi-surface p-4">
      <MissionScuDraftEditor
        lines={lines}
        draft={draft}
        expandedSlugs={expandedSlugs}
        disabled={false}
        isDirty={true}
        saveError={saveError}
        onToggle={(commoditySlug) => {
          setExpandedSlugs((prev) => {
            const next = new Set(prev);
            if (next.has(commoditySlug)) next.delete(commoditySlug);
            else next.add(commoditySlug);
            return next;
          });
        }}
        onChangeCommodity={(commoditySlug, scu) => {
          setSaveError(null);
          setDraft((prev) =>
            missionScuAmounts.setCommodityScuInDraft(prev, commoditySlug, scu),
          );
        }}
        onChangeDelivery={(commoditySlug, locationSlug, scu) => {
          setSaveError(null);
          setDraft((prev) =>
            missionScuAmounts.setDeliveryScuInDraft(
              prev,
              commoditySlug,
              locationSlug,
              scu,
            ),
          );
        }}
        onChangePickup={(commoditySlug, locationSlug, scu) => {
          setSaveError(null);
          setDraft((prev) =>
            missionScuAmounts.setPickupScuInDraft(
              prev,
              commoditySlug,
              locationSlug,
              scu,
            ),
          );
        }}
        onSkipPickup={(commoditySlug, locationSlug) => {
          setSaveError(null);
          setDraft((prev) =>
            missionScuAmounts.skipPickupInDraft(
              prev,
              commoditySlug,
              locationSlug,
            ),
          );
        }}
        onReset={() => {
          setDraft(baseline);
          setSaveError(null);
        }}
        onSave={() => {
          const check = missionScuAmounts.validateDraft(draft);
          if (!check.ok) {
            setSaveError(check.error);
            return;
          }
          setSaveError(null);
        }}
      />
    </div>
  );
}

export const SimpleTotals: Story = {
  args: {
    lines: [],
    draft: missionScuAmounts.draftFromMission(mission, null),
    expandedSlugs: new Set(),
    disabled: false,
    isDirty: false,
    saveError: null,
    onToggle: () => {},
    onChangeCommodity: () => {},
    onChangeDelivery: () => {},
    onChangePickup: () => {},
    onSkipPickup: () => {},
    onReset: () => {},
    onSave: () => {},
  },
  render: () => <Interactive source={mission} />,
};

export const NestedDeliveries: Story = {
  args: {
    lines: [],
    draft: missionScuAmounts.draftFromMission(nestedMission, null),
    expandedSlugs: new Set(),
    disabled: false,
    isDirty: false,
    saveError: null,
    onToggle: () => {},
    onChangeCommodity: () => {},
    onChangeDelivery: () => {},
    onChangePickup: () => {},
    onSkipPickup: () => {},
    onReset: () => {},
    onSave: () => {},
  },
  render: () => <Interactive source={nestedMission} />,
};

const nestedPickupsMission = {
  ...mission,
  id: "nested-pickups",
  cargo: [{ commodity: "Quartz (Raw)", scu: 11 }],
  cargoSummary: "11 SCU Quartz (Raw)",
  from: [
    "Shubin Mining Facility SM0-18",
    "Shubin Mining Facility SM0-22",
    "Shubin Mining Facility SM0-10",
    "Shubin Mining Facility SM0-13",
  ],
  to: ["Covalex Distribution Centre S4DC05"],
  scuSplits: [
    {
      kind: "deliver" as const,
      fromLocationSlug: "shubin-mining-facility-sm0-18",
      toLocationSlug: "covalex-distribution-centre-s4dc05",
      commoditySlug: "quartz-raw",
      commodityName: "Quartz (Raw)",
      scu: 2,
    },
    {
      kind: "deliver" as const,
      fromLocationSlug: "shubin-mining-facility-sm0-22",
      toLocationSlug: "covalex-distribution-centre-s4dc05",
      commoditySlug: "quartz-raw",
      commodityName: "Quartz (Raw)",
      scu: 5,
    },
    {
      kind: "deliver" as const,
      fromLocationSlug: "shubin-mining-facility-sm0-10",
      toLocationSlug: "covalex-distribution-centre-s4dc05",
      commoditySlug: "quartz-raw",
      commodityName: "Quartz (Raw)",
      scu: 2,
    },
    {
      kind: "deliver" as const,
      fromLocationSlug: "shubin-mining-facility-sm0-13",
      toLocationSlug: "covalex-distribution-centre-s4dc05",
      commoditySlug: "quartz-raw",
      commodityName: "Quartz (Raw)",
      scu: 2,
    },
  ],
};

export const NestedPickupAndDeliver: Story = {
  args: {
    lines: [],
    draft: missionScuAmounts.draftFromMission(nestedPickupsMission, null),
    expandedSlugs: new Set(),
    disabled: false,
    isDirty: false,
    saveError: null,
    onToggle: () => {},
    onChangeCommodity: () => {},
    onChangeDelivery: () => {},
    onChangePickup: () => {},
    onSkipPickup: () => {},
    onReset: () => {},
    onSave: () => {},
  },
  render: () => <Interactive source={nestedPickupsMission} />,
};
