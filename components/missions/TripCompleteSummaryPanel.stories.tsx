import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TripCompleteSummaryPanel } from "@/components/missions/TripCompleteSummaryPanel";

const meta = {
  title: "Missions/TripCompleteSummaryPanel",
  component: TripCompleteSummaryPanel,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "End-of-trip report shown inline in the checklist when every stop is done (Stops rail stays visible). Table covers time, contracts, stops, peak SCU, distance, aUEC with Split ½, XP; Run again.",
      },
    },
  },
} satisfies Meta<typeof TripCompleteSummaryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Complete: Story = {
  args: {
    sessionName: "Hurston Covalex — ice + fuels",
    elapsedLabel: "1h 24m",
    contractsDone: 5,
    stopsDone: 9,
    peakScu: 340,
    auecEarned: 766_250,
    xpEarned: 12_480,
    distanceTotal: { unit: "Mm", value: 48.732 },
    isBusy: false,
    onRunAgain: () => {},
  },
  decorators: [
    (Story) => (
      <div className="flex justify-center bg-rsi-bg-deep/25 p-4">
        <Story />
      </div>
    ),
  ],
};
