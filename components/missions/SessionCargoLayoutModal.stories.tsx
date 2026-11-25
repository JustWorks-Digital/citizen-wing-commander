import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mockSessionChecklist } from "@/lib/missions/mockSession";

import type { CargoBayHeaderAsideContext } from "./CargoBayLayout";
import { SessionInventoryStat } from "./SessionStatsStrip";
import { SessionCargoLayoutModal } from "./SessionCargoLayoutModal";

const meta = {
  title: "Missions/SessionCargoLayoutModal",
  component: SessionCargoLayoutModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Centered Cargo bays modal from sticky Cargo bay. Embeds CargoBayLayout with Packing + All / {shortName} (location = All-grid filter) above the left grid; bottom-right corner resizes width and height together (persisted per trip). Fullscreen toggle fills the browser (persisted); Esc exits fullscreen first, then dismisses. Fullscreen / close sit in a reserved chrome strip above the panel (never over Peel / Legend); backdrop also dismisses. Header shows stop transfer SCU (left of Contracts total), On grid (placed / capacity, or contracts total on All), and bay load.",
      },
    },
  },
} satisfies Meta<typeof SessionCargoLayoutModal>;

export default meta;
type Story = StoryObj<typeof meta>;

const openArgs = {
  open: true,
  rows: mockSessionChecklist.rows,
  shipSlug: mockSessionChecklist.shipSlugs[0] ?? "c2-hercules-starlifter",
  sessionId: mockSessionChecklist.id,
  focusedStopId: mockSessionChecklist.rows[0]?.id ?? null,
  onClose: () => {},
  headerAside: ({
    gridPlacedScu,
    stopTransfers,
    stopLabel,
  }: CargoBayHeaderAsideContext) => (
    <SessionInventoryStat
      onboardScu={24}
      peakScu={72}
      missionsTotalScu={144}
      gridPlacedScu={gridPlacedScu}
      missionScuBreakdown={[]}
      sessionId={mockSessionChecklist.id}
      totalCapacity={696}
      availableScu={624}
      stopTransfers={stopTransfers}
      stopLabel={stopLabel}
    />
  ),
} satisfies Story["args"];

export const Open: Story = {
  args: openArgs,
};

/** Seeds fullscreen pref before mount so the modal opens edge-to-edge. */
export const OpenFullscreen: Story = {
  args: {
    ...openArgs,
    sessionId: `${mockSessionChecklist.id}-fullscreen-story`,
  },
  decorators: [
    (Story) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `cwc:session:${mockSessionChecklist.id}-fullscreen-story:cargoBayLayoutFullscreen`,
          "1",
        );
      }
      return <Story />;
    },
  ],
};
