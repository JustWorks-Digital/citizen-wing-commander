import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { TripCompleteSummaryModal } from "@/components/missions/TripCompleteSummaryModal";
import { Button } from "@/components/ui/Button";

const meta = {
  title: "Missions/TripCompleteSummaryModal",
  component: TripCompleteSummaryModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "End-of-trip report when every stop is done. Header Finished control (stop-done checkbox language) dismisses the summary; table covers time, contracts, stops, peak SCU, distance, aUEC with Split ½, XP; Run again / Continue.",
      },
    },
  },
} satisfies Meta<typeof TripCompleteSummaryModal>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  open: true,
  sessionName: "Hurston Covalex — ice + fuels",
  elapsedLabel: "1h 24m",
  contractsDone: 5,
  stopsDone: 9,
  peakScu: 340,
  auecEarned: 766_250,
  xpEarned: 12_480,
  distanceTotal: { unit: "Mm" as const, value: 48.732 },
  isBusy: false,
  onClose: () => {},
  onRunAgain: () => {},
};

export const Complete: Story = {
  args: baseArgs,
};

export const Interactive: Story = {
  args: baseArgs,
  render: function InteractiveTripComplete() {
    const [open, setOpen] = useState(true);
    return (
      <div className="flex min-h-[28rem] items-center justify-center bg-rsi-bg p-6">
        <Button type="button" onClick={() => setOpen(true)}>
          Show summary
        </Button>
        <TripCompleteSummaryModal
          {...baseArgs}
          open={open}
          onClose={() => setOpen(false)}
          onRunAgain={() => setOpen(false)}
        />
      </div>
    );
  },
};
