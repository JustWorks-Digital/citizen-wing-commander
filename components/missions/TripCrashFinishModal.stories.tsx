import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { TripCrashFinishModal } from "./TripCrashFinishModal";

const meta = {
  title: "Missions/TripCrashFinishModal",
  component: TripCrashFinishModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Opened from the route checklist ⋯ menu (Crash out). Ends the session with finishStatus crash and optional incident notes in finishFeedback.",
      },
    },
  },
} satisfies Meta<typeof TripCrashFinishModal>;

export default meta;
type Story = StoryObj<typeof meta>;

function Interactive() {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-h-[24rem] bg-rsi-bg p-6">
      <button
        type="button"
        className="rounded-rsi border border-rsi-border px-3 py-1.5 font-mono text-xs text-rsi-text"
        onClick={() => setOpen(true)}
      >
        Open crash finish
      </button>
      <TripCrashFinishModal
        open={open}
        sessionName="microTech Covalex — Experienced Local"
        isBusy={busy}
        onClose={() => setOpen(false)}
        onConfirm={async (feedback) => {
          setBusy(true);
          await new Promise((resolve) => setTimeout(resolve, 400));
          console.info("crash finish", feedback);
          setBusy(false);
          setOpen(false);
        }}
      />
    </div>
  );
}

export const Default: Story = {
  args: {
    open: true,
    sessionName: "Demo trip",
    onClose: () => undefined,
    onConfirm: () => undefined,
  },
  render: () => <Interactive />,
};
