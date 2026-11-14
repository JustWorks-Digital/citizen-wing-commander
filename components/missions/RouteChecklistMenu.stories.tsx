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
          "Right-edge ⋯ on the route checklist toolbar. Opens trip time, Hide / Show history, and the Controls keyboard list.",
      },
    },
  },
  args: {
    hideCompleted: false,
    completedCount: 2,
    onToggleHistory: () => {},
    elapsed: (
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-secondary">
        <span className="text-rsi-text-muted">Time </span>1h 24m
      </p>
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

export const Interactive: Story = {
  render: function InteractiveMenu() {
    const [hideCompleted, setHideCompleted] = useState(false);
    return (
      <div className="flex w-80 justify-end rounded-rsi border border-rsi-border bg-rsi-bg-deep/95 px-3 py-2">
        <RouteChecklistMenu
          hideCompleted={hideCompleted}
          completedCount={2}
          onToggleHistory={() => setHideCompleted((value) => !value)}
        />
      </div>
    );
  },
};
