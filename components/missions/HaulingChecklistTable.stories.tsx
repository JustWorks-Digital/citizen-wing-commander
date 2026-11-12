import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import {
  insertQuantumTravelAfter,
  updateChecklistRowLocation,
  updateQuantumTravelEndpoints,
} from "@/lib/missions/quantumTravel";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import { syncMissionsForStopCompletion } from "@/lib/missions/expectedCompletions";
import { listLocationShops } from "@/lib/fixtures/locationShops";
import {
  defaultFocusedStopId,
  HaulingChecklistTable,
  QUANTUM_ORIGIN_ROW_ID,
} from "./HaulingChecklistTable";

const meta = {
  title: "Missions/HaulingChecklistTable",
  component: HaulingChecklistTable,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Stacked stop cards — the route checklist (same on mobile and desktop). Sticky Contracts / Stops / Cargo bay / aUEC toolbar; ⋯ menu holds Hide / Show history and Controls. Stop headers show a wiki location thumbnail with unique shortName under it (e.g. Tressler, Cassillo). When start ≠ first stop, a compact Quantum-to row is active first (no bay/cargo columns). Double-click current location or destination on a Quantum row to retarget via fuzzy search. A + under each stop opens a quantum-travel composer (current location locked, pick desired) and inserts a matching Quantum row. Completed stops get an angled COMPLETED stamp centered on the Collect / Drop off pad. Station → Ship / Ship → Station transfer blocks (cargoInventory.transferLedgerByStop; pickup/delivery as ScuTransfer | false) sit under Collect in the left column; Next stop pins under that column. Collect / Drop off: double-click the under-stack cargo label (or Breakdown row) to open the large box-types modal. Relevant contracts (rank / name / SCU / reward; click for details) then Payout + approximate Exp (hauling XP by contract rank) under the cargo tiles. Commodity tiles under Pickup/Delivery: click to mark handled (persisted). Completing a stop scrolls the next one to the top unless history is hidden; the ⋯ menu toggles Hide history / Show history.",
      },
    },
  },
} satisfies Meta<typeof HaulingChecklistTable>;

export default meta;
type Story = StoryObj<typeof meta>;

function InteractiveTable(args: {
  rows: typeof mockSessionChecklist.rows;
  onToggle: (rowId: string) => void;
  missions?: typeof mockSessionChecklist.missions;
  sessionId?: string | null;
  startLocationSlug?: string | null;
}) {
  const [rows, setRows] = useState(args.rows);
  const [missions, setMissions] = useState(
    args.missions ?? mockSessionChecklist.missions,
  );
  const [startLocationSlug, setStartLocationSlug] = useState(
    args.startLocationSlug ?? null,
  );
  const [focusedStopId, setFocusedStopId] = useState<string | null>(
    defaultFocusedStopId(args.rows, args.startLocationSlug),
  );

  return (
    <HaulingChecklistTable
      rows={rows}
      focusedStopId={focusedStopId}
      onFocusStop={setFocusedStopId}
      missions={missions}
      sessionId={args.sessionId ?? mockSessionChecklist.id}
      startLocationSlug={startLocationSlug}
      onInsertQuantumTravel={({ afterRowId, fromSlug, toSlug, reasonShopSlug }) => {
        setRows((prev) =>
          insertQuantumTravelAfter(prev, afterRowId, {
            fromSlug,
            toSlug,
            reasonShopSlug,
          }),
        );
      }}
      onUpdateQuantumTravel={({ rowId, fromSlug, toSlug }) => {
        if (rowId === QUANTUM_ORIGIN_ROW_ID) {
          if (fromSlug) setStartLocationSlug(fromSlug);
          if (toSlug) {
            setRows((prev) => {
              const first = prev[0];
              if (!first) return prev;
              const updated = updateChecklistRowLocation(
                prev,
                first.id,
                toSlug,
              );
              return updated.ok ? updated.rows : prev;
            });
          }
          return;
        }
        setRows((prev) => {
          const updated = updateQuantumTravelEndpoints(
            prev,
            rowId,
            { fromSlug, toSlug },
            {
              isReasonValidAtDestination: (reasonShopSlug, destination) =>
                listLocationShops(destination).some(
                  (shop) => shop.slug === reasonShopSlug,
                ),
            },
          );
          return updated.ok ? updated.rows : prev;
        });
      }}
      onToggle={(rowId) => {
        setRows((prevRows) => {
          const target = prevRows.find((row) => row.id === rowId);
          if (!target) return prevRows;
          const stopIsCompleted = !target.isCompleted;
          setMissions((prevMissions) =>
            syncMissionsForStopCompletion({
              missions: prevMissions,
              rows: prevRows,
              rowId,
              stopIsCompleted,
            }),
          );
          return prevRows.map((row) =>
            row.id === rowId
              ? { ...row, isCompleted: stopIsCompleted }
              : row,
          );
        });
      }}
      onSelectBoxBreakdown={(missionId, breakdown: ScuBoxSplits) => {
        setMissions((prev) =>
          prev.map((mission) =>
            mission.id === missionId
              ? { ...mission, scuBoxSplits: breakdown }
              : mission,
          ),
        );
      }}
    />
  );
}

export const Default: Story = {
  args: {
    rows: mockSessionChecklist.rows,
    onToggle: () => {},
    missions: mockSessionChecklist.missions,
    sessionId: mockSessionChecklist.id,
    startLocationSlug: mockSessionChecklist.startLocationSlug,
  },
  render: (args) => <InteractiveTable {...args} />,
};

/** Start differs from first stop — compact Quantum origin row is active. */
export const QuantumOrigin: Story = {
  args: {
    rows: mockSessionChecklist.rows.map((row, index) =>
      index === 0
        ? {
            ...row,
            isCompleted: false,
            locationSlug: "port-tressler",
          }
        : { ...row, isCompleted: false },
    ),
    onToggle: () => {},
    missions: mockSessionChecklist.missions,
    sessionId: mockSessionChecklist.id,
    startLocationSlug: "everus-harbor",
  },
  render: (args) => <InteractiveTable {...args} />,
};

export const Mobile: Story = {
  args: {
    rows: mockSessionChecklist.rows,
    onToggle: () => {},
    missions: mockSessionChecklist.missions,
    sessionId: mockSessionChecklist.id,
    startLocationSlug: mockSessionChecklist.startLocationSlug,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[390px] bg-rsi-bg p-3">
        <Story />
      </div>
    ),
  ],
  render: (args) => <InteractiveTable {...args} />,
};
