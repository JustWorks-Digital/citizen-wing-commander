import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { HaulingChecklistTable } from "./HaulingChecklistTable";

const meta = {
  title: "Missions/HaulingChecklistTable",
  component: HaulingChecklistTable,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof HaulingChecklistTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    rows: mockSessionChecklist.rows,
    onToggle: () => {},
  },
  render: function Render(args) {
    const [rows, setRows] = useState(args.rows);

    return (
      <HaulingChecklistTable
        rows={rows}
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
  },
};
