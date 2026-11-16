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
    onReset: () => {},
    onSave: () => {},
  },
  render: () => <Interactive source={nestedMission} />,
};
