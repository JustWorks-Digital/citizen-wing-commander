import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { reorderChecklistStops } from "@/lib/missions/reorderStops";
import { SessionStopsTimelineModal } from "./SessionStopsTimelineModal";

const meta = {
  title: "Missions/SessionStopsTimelineModal",
  component: SessionStopsTimelineModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Trip stops timeline from the sticky Stops stat: eyebrow Trip, title Stops - N/M (ASCII hyphen). Before any stop is complete, drag handles reorder stops (Save order / Cancel). Reset trip clears stop completion only (contracts stay) to unlock reorder. Continuous completion progress bar above the distance summary. Location thumbnails per stop, completed vs ahead, leg distances, traveled / remaining / total. Start is omitted when it matches stop 1. Density scales with stop count.",
      },
    },
  },
  args: {
    open: true,
    rows: mockSessionChecklist.rows,
    startLocationSlug: mockSessionChecklist.startLocationSlug,
    onClose: () => {},
    onResetTrip: () => {},
  },
} satisfies Meta<typeof SessionStopsTimelineModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MidRoute: Story = {
  args: {
    rows: mockSessionChecklist.rows.map((row, index) => ({
      ...row,
      isCompleted: index === 0,
    })),
  },
};

export const AllComplete: Story = {
  args: {
    rows: mockSessionChecklist.rows.map((row) => ({
      ...row,
      isCompleted: true,
    })),
  },
};

export const Reorderable: Story = {
  args: {
    open: true,
    rows: mockSessionChecklist.rows.map((row) => ({
      ...row,
      isCompleted: false,
    })),
    startLocationSlug: mockSessionChecklist.startLocationSlug,
    onClose: () => {},
  },
  render: (args) => {
    const [open, setOpen] = useState(true);
    const [rows, setRows] = useState(args.rows);
    return (
      <div className="p-6">
        <button
          type="button"
          className="rounded-rsi border border-rsi-border px-3 py-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text"
          onClick={() => setOpen(true)}
        >
          Open stops
        </button>
        <SessionStopsTimelineModal
          {...args}
          open={open}
          rows={rows}
          onClose={() => setOpen(false)}
          onResetTrip={() => {
            setRows((prev) =>
              prev.map((row) => ({ ...row, isCompleted: false })),
            );
          }}
          onReorderStops={(orderedIds) => {
            setRows((prev) => {
              const result = reorderChecklistStops(prev, orderedIds);
              return result.ok ? result.rows : prev;
            });
          }}
        />
      </div>
    );
  },
};

export const Interactive: Story = {
  args: {
    open: true,
    rows: mockSessionChecklist.rows,
    startLocationSlug: mockSessionChecklist.startLocationSlug,
    onClose: () => {},
  },
  render: (args) => {
    const [open, setOpen] = useState(true);
    return (
      <div className="p-6">
        <button
          type="button"
          className="rounded-rsi border border-rsi-border px-3 py-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text"
          onClick={() => setOpen(true)}
        >
          Open stops
        </button>
        <SessionStopsTimelineModal
          {...args}
          open={open}
          onClose={() => setOpen(false)}
        />
      </div>
    );
  },
};
