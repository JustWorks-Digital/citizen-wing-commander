import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import {
  insertQuantumTravelAfter,
  updateChecklistRowLocation,
  updateQuantumTravelEndpoints,
} from "@/lib/missions/quantumTravel";
import type { ScuBoxSplits } from "@/lib/missions/catalogMission";
import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
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
          "Stacked stop cards — the route checklist (same on mobile and desktop). Sticky Contracts / Stops / Bay / Distance / aUEC toolbar; ⋯ menu holds Hide / Show history and Controls. Stop order is edited in the Trip Stops modal (not here). Stop headers show a wiki location thumbnail with unique shortName under it (e.g. Tressler, Cassillo); the Done checkbox left of that image shows a spinner while save finishes. When start ≠ first stop, a compact Quantum row is active first (session ship badge left of triple >>> chevrons; destination name only — no “Quantum to” prefix). Double-click current location or destination on a Quantum row to retarget via fuzzy search. A + under each stop opens a quantum-travel composer (current location locked, pick desired) and inserts a matching Quantum row. With history shown, completed stops collapse to a horizontal Done strip (checkbox, location, SCU); Next stop bridges below until the following stop is done. With history hidden, completed cards drop out but the Next stop bridge still introduces the current incomplete stop. Active stops: Pickup / Drop off contract cards + commodity tiles; Station/Ship transfer blocks; Payout + Exp; bay preview; Next stop footer with ship badge + >>> (clickable to mark done). Completing a stop scrolls the next Next-stop bridge flush under the sticky toolbar.",
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
  shipSlug?: string | null;
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
      shipSlug={
        args.shipSlug ?? mockSessionChecklist.shipSlugs?.[0] ?? null
      }
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
      onSelectBoxBreakdown={(missionId, commoditySlug, breakdown: ScuBoxSplits) => {
        setMissions((prev) =>
          prev.map((mission) =>
            mission.id === missionId
              ? cargoBoxSplits.setCommodity(mission, commoditySlug, breakdown)
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
