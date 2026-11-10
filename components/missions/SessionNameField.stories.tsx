"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { SessionNameField } from "./SessionNameField";

const meta = {
  title: "Missions/SessionNameField",
  component: SessionNameField,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof SessionNameField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    name: "Hurston Covalex — 8 contracts",
    onRename: () => {},
  },
  render: function Render(args) {
    const [name, setName] = useState(args.name);
    return (
      <div className="max-w-md">
        <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-rsi-accent">
          Session
        </p>
        <SessionNameField
          name={name}
          onRename={setName}
          disabled={args.disabled}
        />
      </div>
    );
  },
};

export const Disabled: Story = {
  args: {
    name: "Read-only session",
    onRename: () => {},
    disabled: true,
  },
};
