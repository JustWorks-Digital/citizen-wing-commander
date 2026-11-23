import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  DeliveryTransferBlock,
  PickupTransferBlock,
} from "./TransferBlocks";

const meta = {
  title: "Missions/Checklist/TransferBlocks",
  parameters: {
    layout: "padded",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

const pickupTransfer = { before: 36, amount: 16, after: 52 };
const deliveryTransfer = { before: 52, amount: 16, after: 36 };

export const PickupReceipt: Story = {
  name: "Pickup receipt",
  render: () => (
    <div className="max-w-md">
      <PickupTransferBlock
        location="Port Tressler"
        locationSlug="port-tressler"
        shipName="C2 Hercules"
        shipSlug="c2-hercules-starlifter"
        transfer={pickupTransfer}
        isDone={false}
      />
    </div>
  ),
};

export const DeliveryReceipt: Story = {
  name: "Drop-off receipt",
  render: () => (
    <div className="max-w-md">
      <DeliveryTransferBlock
        location="HDPC-Cassillo"
        locationSlug="hdpc-cassillo"
        shipName="C2 Hercules"
        shipSlug="c2-hercules-starlifter"
        transfer={deliveryTransfer}
        isDone={false}
      />
    </div>
  ),
};

export const PickupDone: Story = {
  name: "Pickup done",
  render: () => (
    <div className="max-w-md">
      <PickupTransferBlock
        location="Port Tressler"
        locationSlug="port-tressler"
        shipName="C2 Hercules"
        shipSlug="c2-hercules-starlifter"
        transfer={pickupTransfer}
        isDone={true}
      />
    </div>
  ),
};
