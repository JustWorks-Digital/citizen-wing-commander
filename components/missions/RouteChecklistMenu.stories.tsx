import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { RouteChecklistMenu } from "./RouteChecklistMenu";

const meta = {
  title: "Missions/RouteChecklistMenu",
  component: RouteChecklistMenu,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Trip-header ⋯ beside Find a Contract (h-9, Contracts-style fill). On small phones shows aUEC; also Prioritize pickup, Promote unfinished, Copy trip, Hide / Show history, Repair route (when the invalid banner was dismissed), Summary (when the trip is complete), Controls, and Crash out.",
      },
    },
  },
  args: {
    hideCompleted: false,
    completedCount: 2,
    onToggleHistory: () => {},
    prioritizePickup: false,
    onPrioritizePickupChange: () => {},
    promoteUnfinished: true,
    onPromoteUnfinishedChange: () => {},
    onCopyTrip: async () => {},
    onLogCrash: () => {},
    overflowStats: (
      <div className="flex flex-col gap-1.5 font-mono text-[0.65rem] tabular-nums text-rsi-text">
        <div>
          <span className="text-rsi-text-muted">Dist </span>12.4 / 48.2 Mm
        </div>
        <div>
          <span className="text-rsi-text-muted">aUEC </span>0 / 128k
        </div>
      </div>
    ),
  },
} satisfies Meta<typeof RouteChecklistMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HideHistory: Story = {};

export const ShowHistory: Story = {
  args: { hideCompleted: true },
};

export const NoCompletedStops: Story = {
  args: { completedCount: 0 },
};

export const WithoutCopyTrip: Story = {
  args: { onCopyTrip: undefined },
};

export const RepairRoute: Story = {
  args: {
    onRepairTrip: () => undefined,
  },
};

export const RepairingRoute: Story = {
  args: {
    onRepairTrip: () => undefined,
    isRepairingTrip: true,
  },
};

export const LogCrash: Story = {
  args: {
    onLogCrash: () => undefined,
    canLogCrash: true,
  },
};

export const CrashAlreadyFinished: Story = {
  args: {
    onLogCrash: () => undefined,
    canLogCrash: false,
  },
};

export const TripCompleteSummary: Story = {
  args: {
    onOpenSummary: () => undefined,
    onLogCrash: undefined,
    canLogCrash: false,
  },
};

export const Interactive: Story = {
  render: function InteractiveMenu() {
    const [hideCompleted, setHideCompleted] = useState(false);
    const [prioritizePickup, setPrioritizePickup] = useState(false);
    const [promoteUnfinished, setPromoteUnfinished] = useState(true);
    return (
      <div className="flex w-80 justify-end rounded-rsi border border-rsi-border bg-rsi-bg-deep/95 px-3 py-2">
        <RouteChecklistMenu
          hideCompleted={hideCompleted}
          completedCount={2}
          onToggleHistory={() => setHideCompleted((value) => !value)}
          prioritizePickup={prioritizePickup}
          onPrioritizePickupChange={setPrioritizePickup}
          promoteUnfinished={promoteUnfinished}
          onPromoteUnfinishedChange={setPromoteUnfinished}
          onCopyTrip={async () => {
            await new Promise((resolve) => setTimeout(resolve, 400));
          }}
          onLogCrash={() => undefined}
        />
      </div>
    );
  },
};

