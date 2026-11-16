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
          "Right-edge ⋯ on the route checklist toolbar, sized and bordered to match the Distance/aUEC/Time strip. On small phones shows Distance/aUEC (Time stays in the strip); also Copy trip, Hide / Show history, Repair route (when the invalid banner was dismissed), and Controls.",
      },
    },
  },
  args: {
    hideCompleted: false,
    completedCount: 2,
    onToggleHistory: () => {},
    onCopyTrip: async () => {},
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

export const Interactive: Story = {
  render: function InteractiveMenu() {
    const [hideCompleted, setHideCompleted] = useState(false);
    return (
      <div className="flex w-80 justify-end rounded-rsi border border-rsi-border bg-rsi-bg-deep/95 px-3 py-2">
        <RouteChecklistMenu
          hideCompleted={hideCompleted}
          completedCount={2}
          onToggleHistory={() => setHideCompleted((value) => !value)}
          onCopyTrip={async () => {
            await new Promise((resolve) => setTimeout(resolve, 400));
          }}
        />
      </div>
    );
  },
};

