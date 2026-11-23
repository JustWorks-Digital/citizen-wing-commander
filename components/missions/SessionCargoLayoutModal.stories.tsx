import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mockSessionChecklist } from "@/lib/missions/mockSession";

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
          "Centered Cargo bays modal from sticky Cargo bay. Embeds CargoBayLayout with All / Transfer scope toggle; left edge resizes width (persisted per trip). Fullscreen toggle fills the browser (persisted); Esc exits fullscreen first, then dismisses. X sits in the mask above the panel (backdrop also dismiss). Header shows Contracts total, On grid (placed / capacity), and bay load; footer shows stop transfer SCU by cargo type.",
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
  headerAside: ({ gridPlacedScu }: { gridPlacedScu: number }) => (
    <SessionInventoryStat
      onboardScu={24}
      peakScu={72}
      missionsTotalScu={144}
      gridPlacedScu={gridPlacedScu}
      missionScuBreakdown={[]}
      sessionId={mockSessionChecklist.id}
      totalCapacity={696}
      availableScu={624}
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
