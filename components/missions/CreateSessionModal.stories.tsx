"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CreateSessionModal } from "./CreateSessionModal";

const meta = {
  title: "Missions/CreateSessionModal",
  component: CreateSessionModal,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof CreateSessionModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    open: true,
    onClose: () => {},
    onCreate: () => {},
  },
  render: function Render(args) {
    const [open, setOpen] = useState(true);
    const [lastName, setLastName] = useState<string | null>(null);
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-rsi-bg p-6">
        <Button type="button" onClick={() => setOpen(true)}>
          New session
        </Button>
        {lastName ? (
          <p className="font-mono text-xs text-rsi-text-muted">
            Created: {lastName}
          </p>
        ) : null}
        <CreateSessionModal
          {...args}
          open={open}
          onClose={() => setOpen(false)}
          onCreate={(name) => {
            setLastName(name);
            setOpen(false);
          }}
        />
      </div>
    );
  },
};
