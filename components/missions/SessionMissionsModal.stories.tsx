import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mockSessionChecklist } from "@/lib/missions/mockSession";

import { SessionMissionsModal } from "./SessionMissionsModal";

const meta = {
  title: "Missions/SessionMissionsModal",
  component: SessionMissionsModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Contracts modal: two-up card grid (one column on narrow). Header title is “N Contracts”; sticky-style totals strip is Stops / Boxes / SCU / aUEC / XP. Click a card to open its source screenshot(s). Cards show rank/title, aUEC·SCU·EXP, cargo, From → To, box mix, ⋯ menu.",
      },
    },
  },
  args: {
    open: true,
    missions: mockSessionChecklist.missions,
    rows: mockSessionChecklist.rows,
    onClose: () => {},
    onToggleHidden: () => {},
    onToggleCompleted: () => {},
    onRemoveMission: () => {},
    onSelectBoxBreakdown: () => {},
  },
} satisfies Meta<typeof SessionMissionsModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Card list with session totals in the header. */
export const Cards: Story = {};

/** Narrow viewport — same card layout. */
export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

/** Opened from a stop Contracts tile — scrolls that card into view. */
export const ScrollToContract: Story = {
  args: {
    focusMissionId: mockSessionChecklist.missions[0]?.id ?? null,
  },
};

export const Empty: Story = {
  args: {
    missions: [],
  },
};
