import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/Button";
import { CargoStorageGridModal } from "./CargoStorageGridModal";

const meta = {
  title: "Missions/CargoStorageGridModal",
  component: CargoStorageGridModal,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof CargoStorageGridModal>;

export default meta;
type Story = StoryObj<typeof meta>;

function OpenModal(
  props: Omit<ComponentProps<typeof CargoStorageGridModal>, "open" | "onClose">,
) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-rsi-bg p-6">
      <Button type="button" onClick={() => setOpen(true)}>
        Open grid
      </Button>
      <CargoStorageGridModal
        {...props}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

export const C2FrontTwelveScu: Story = {
  args: {
    open: true,
    onClose: () => {},
    shipSlug: "c2-hercules-starlifter",
    zone: "front",
    locationLabel: "Area 18",
    segments: [
      {
        commoditySlug: "agricultural-supplies",
        commodityName: "Agricultural Supplies",
        scu: 12,
        color: null,
        color2: null,
      },
    ],
  },
  render: (args) => <OpenModal {...args} />,
};

export const ThirteenScuOdd: Story = {
  args: {
    open: true,
    onClose: () => {},
    shipSlug: "c2-hercules-starlifter",
    zone: "rear",
    locationLabel: "Orison",
    segments: [
      {
        commoditySlug: "medical-supplies",
        commodityName: "Medical Supplies",
        scu: 13,
        color: null,
        color2: null,
      },
    ],
  },
  render: (args) => <OpenModal {...args} />,
};
