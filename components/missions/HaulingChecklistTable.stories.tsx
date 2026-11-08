import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { HaulingChecklistTable } from "./HaulingChecklistTable";

const meta = {
  title: "Missions/HaulingChecklistTable",
  component: HaulingChecklistTable,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Checklist rows with location, clickable cargo (opens bay grid), totals, and next distance.",
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

  return (
    <HaulingChecklistTable
      rows={rows}
      shipSlug={mockSessionChecklist.shipSlugs[0] ?? null}
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
    shipSlug: mockSessionChecklist.shipSlugs[0] ?? null,
  },
  render: (args) => <InteractiveTable {...args} />,
};

export const Mobile: Story = {
  args: {
    rows: mockSessionChecklist.rows,
    onToggle: () => {},
    shipSlug: mockSessionChecklist.shipSlugs[0] ?? null,
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
