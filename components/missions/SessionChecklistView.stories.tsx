import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { SessionChecklistView } from "./SessionChecklistView";

const meta = {
  title: "Missions/SessionChecklistView",
  component: SessionChecklistView,
  parameters: {
    layout: "padded",
  },
  args: {
    initial: mockSessionChecklist,
  },
} satisfies Meta<typeof SessionChecklistView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Inventory shows mission cargo in red when contracts exceed ship bay SCU. */
export const MissionCargoOverCapacity: Story = {
  args: {
    initial: {
      ...mockSessionChecklist,
      shipSlugs: ["constellation-mk-v-centaurus"],
      missionCount: 1,
      missionsCompleted: 0,
      missions: [
        {
          id: "over-capacity",
          title: "Junior Rank - Direct Medium Cargo Haul",
          contractor: "Covalex Independent Contractors",
          rewardAuec: 80000,
          rewardDisplay: "80k",
          from: ["Everus Harbor"],
          to: ["Lorville"],
          cargo: [{ commodity: "Stims", scu: 280 }],
          maxContainerScu: 8,
          cargoSummary: "280 SCU Stims",
          isCompleted: false,
          isHidden: false,
          screenshots: [],
          mobiglas: {
            tab: "Accepted",
            category: "Hauling - Planetary",
            title: "Junior Rank - Direct Medium Cargo Haul",
            contractor: "Covalex Independent Contractors",
            rewardAuec: 80000,
            rewardDisplay: "80k",
            timeRemaining: null,
            deadline: null,
            details: "Haul 280 SCU Stims from Everus Harbor to Lorville.",
            objectives: [
              {
                label: "Deliver 0/280 SCU of Stims to Lorville",
                progressCurrent: 0,
                progressTotal: 280,
                children: ["Collect item from Everus Harbor"],
              },
            ],
          },
        },
      ],
    },
  },
};
