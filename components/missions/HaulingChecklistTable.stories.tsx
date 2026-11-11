import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { insertQuantumTravelAfter } from "@/lib/missions/quantumTravel";
import {
  defaultFocusedStopId,
  HaulingChecklistTable,
} from "./HaulingChecklistTable";

const meta = {
  title: "Missions/HaulingChecklistTable",
  component: HaulingChecklistTable,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Stacked stop cards (same on mobile and desktop). Sticky Contracts / Stops / Cargo / Hide history toolbar. Stop headers show a wiki location thumbnail when available. When start ≠ first stop, a compact Quantum-to row is active first (no bay/cargo columns). A + under each stop opens a quantum-travel composer (current location locked, pick desired) and inserts a matching Quantum row. Completed stops get an angled COMPLETED stamp under the delivery grid. Station → Ship / Ship → Station transfer blocks sit under the pad graph (right column on desktop). Contracts (rank / name / SCU; click for details) then Payout under the cargo tiles. Commodity tiles under Pickup/Delivery: click to mark handled (persisted). Completing a stop scrolls the next one to the top unless Hide history is on.",
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
  const [focusedStopId, setFocusedStopId] = useState<string | null>(
    defaultFocusedStopId(args.rows, args.startLocationSlug),
  );

  return (
    <HaulingChecklistTable
      rows={rows}
      focusedStopId={focusedStopId}
      onFocusStop={setFocusedStopId}
      missions={args.missions ?? mockSessionChecklist.missions}
      sessionId={args.sessionId ?? mockSessionChecklist.id}
      startLocationSlug={args.startLocationSlug ?? null}
      onInsertQuantumTravel={({ afterRowId, fromSlug, toSlug, reasonShopSlug }) => {
        setRows((prev) =>
          insertQuantumTravelAfter(prev, afterRowId, {
            fromSlug,
            toSlug,
            reasonShopSlug,
          }),
        );
      }}
      onToggle={(rowId) => {
        setRows((prev) =>
          prev.map((row) =>
            row.id === rowId
              ? { ...row, isCompleted: !row.isCompleted }
              : row,
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
