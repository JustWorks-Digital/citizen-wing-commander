import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
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
          "Checklist rows with location, cargo, totals, and next distance. Click a row to focus it in cargo layout (including completed stops).",
      },
    },
  },
} satisfies Meta<typeof HaulingChecklistTable>;

export default meta;
type Story = StoryObj<typeof meta>;

function InteractiveTable(args: {
  rows: typeof mockSessionChecklist.rows;
  onToggle: (rowId: string) => void;
}) {
  const [rows, setRows] = useState(args.rows);
  const [focusedStopId, setFocusedStopId] = useState<string | null>(
    defaultFocusedStopId(args.rows),
  );

  return (
    <HaulingChecklistTable
      rows={rows}
      focusedStopId={focusedStopId}
      onFocusStop={setFocusedStopId}
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
  },
  render: (args) => <InteractiveTable {...args} />,
};

export const Mobile: Story = {
  args: {
    rows: mockSessionChecklist.rows,
    onToggle: () => {},
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
