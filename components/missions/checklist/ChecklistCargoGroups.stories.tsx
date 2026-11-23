import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { describeCargoDeliveries } from "@/lib/fixtures";
import { mockSessionChecklist } from "@/lib/missions/mockSession";
import { StopDeliveryBayPreview } from "../StopDeliveryBayPreview";
import { CargoGroups } from "./ChecklistCargoTiles";

const hubRow =
  mockSessionChecklist.rows.find(
    (row) => row.routeAction === "pickup_delivery",
  ) ?? mockSessionChecklist.rows[0]!;

const meta = {
  title: "Missions/Checklist/CargoGroups",
  component: CargoGroups,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Stop cargo sections. When both Drop off and Pick up exist, they render as tabs (one role at a time; Prioritize pickup flips tab order). The active tab merges into a shared tinted shell with the transfer receipt, mission cards, and pad graph. Finishing a role jumps to the other tab when it is still open; completing the last remaining role stays on that tab.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[min(100%,52rem)] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CargoGroups>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Hub stop with Drop off + Pick up — tab switches cargo + pad graph. */
export const PickupDropoffTabs: Story = {
  args: {
    row: hubRow,
    cargoLines: describeCargoDeliveries(hubRow.cargoDeliveries),
    missions: mockSessionChecklist.missions,
    location: "Orison",
    shipName: "C2 Hercules",
    shipSlug: "c2-hercules-starlifter",
    sessionId: mockSessionChecklist.id,
    prioritizePickup: false,
    transferLedger: {
      delivery: { before: 24, amount: 24, after: 0 },
      pickup: { before: 0, amount: 40, after: 40 },
    },
    onToggleCargoHandled: () => undefined,
    bayAside: (role) => (
      <StopDeliveryBayPreview
        row={hubRow}
        rows={mockSessionChecklist.rows}
        missions={mockSessionChecklist.missions}
        role={role}
      />
    ),
  },
};

/** Same hub with Prioritize pickup — Pick up tab on the left. */
export const PrioritizePickupTabs: Story = {
  args: {
    ...PickupDropoffTabs.args,
    prioritizePickup: true,
  },
};

/** Pickup-only stop — no tabs, single section label. */
export const PickupOnly: Story = {
  args: {
    row: mockSessionChecklist.rows[0]!,
    cargoLines: describeCargoDeliveries(
      mockSessionChecklist.rows[0]!.cargoDeliveries,
    ),
    missions: mockSessionChecklist.missions,
    location: "Area18",
    shipName: "C2 Hercules",
    shipSlug: "c2-hercules-starlifter",
    transferLedger: {
      pickup: { before: 0, amount: 17, after: 17 },
      delivery: false,
    },
  },
};
