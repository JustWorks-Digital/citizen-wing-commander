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
          "Stacked stop cards — the route checklist (same on mobile and desktop). Sticky toolbar: Contract/Stop/Bay strip, Distance/aUEC/Time strip right-aligned, then a matching-height ⋯ control (below sm, Distance/aUEC move into ⋯ and Time stays in the strip); ⋯ menu holds Copy trip, Hide / Show history, Repair route (after dismissing the invalid-trip banner), and Controls. Location name uses a smaller title size with a little space above pickup/delivery tags. Stop order is edited in the Trip Stops modal (not here). Stop headers show a wiki location thumbnail with unique shortName under it (e.g. Tressler, Cassillo); the Done checkbox (desktop left column) sticks under the toolbar; on mobile a full-width In progress / Complete checkbox sits above Next stop (and still toggles after done). Distances use fewer decimals on mobile. When start ≠ first stop, a compact Quantum row is active first (50/50 current | destination; destination thumb; hop distance under the full destination title; mobile puts ship on its own line). Completed Quantum hops and cargo stops collapse to a Done strip; click a strip to expand the full card (Collapse to fold again). Double-click current location or destination on a Quantum row to retarget via fuzzy search. A + under each stop opens a quantum-travel composer (current location locked, pick desired) and inserts a matching Quantum row. With history shown, completed stops collapse to a horizontal Done strip (checkbox, location, SCU); Next stop bridges below until the following stop is done. With history hidden, completed cards drop out but the Next stop bridge still introduces the current incomplete stop. Active stops: Pick up / Drop off contract cards (2-up from ~450px, 3-up md–lg, 2-up above lg) + commodity tiles (full cargo name on the tile; tap marks handled); transfer blocks (Pick up Station→Ship, Drop off Ship→Station; withdrawal/deposit labels; ship totals as SCU total; station/ship names beside thumbs from ~450px up); Breakdown tops align with transfer; no Trip complete on the last stop; Payout + Exp (width matched to Pick up / Drop off column); Breakdown pad graphs; Next stop footer and transition bridges both show a larger ship badge + >>> (footer clickable to mark done). Completing a stop scrolls the next Next-stop bridge flush under the sticky toolbar.",
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
              ? {
                  ...cargoBoxSplits.setCommodity(
                    mission,
                    commoditySlug,
                    breakdown,
                  ),
                  scuBoxSplitsCertainty: "known" as const,
                }
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

/** Crate mix not hangar-confirmed — warn circle on Breakdown under-stack labels. */
export const EstimatedBoxSplits: Story = {
  args: {
    rows: mockSessionChecklist.rows,
    onToggle: () => {},
    missions: mockSessionChecklist.missions.map((mission) => ({
      ...mission,
      scuBoxSplitsCertainty: "estimated" as const,
    })),
    sessionId: mockSessionChecklist.id,
    startLocationSlug: mockSessionChecklist.startLocationSlug,
  },
  render: (args) => <InteractiveTable {...args} />,
};

/** Initial page / session hydrate — spinner until checklist details arrive. */
export const Loading: Story = {
  args: {
    rows: [],
    onToggle: () => {},
    isLoading: true,
  },
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

/** Same as Quantum origin with the RSI Galaxy ship badge. */
export const GalaxyShipBadge: Story = {
  args: {
    ...QuantumOrigin.args,
    shipSlug: "galaxy",
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
