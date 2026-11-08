import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@/components/ui/Badge";
import { OutdoorFreightBadge } from "./OutdoorFreightBadge";

const meta = {
  title: "Missions/OutdoorFreightBadge",
  component: OutdoorFreightBadge,
  parameters: {
    layout: "centered",
  },
  args: {
    locationSlug: "baijini-point",
  },
} satisfies Meta<typeof OutdoorFreightBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BaijiniPoint: Story = {
  args: { locationSlug: "baijini-point" },
};

export const EverusHarbor: Story = {
  args: { locationSlug: "everus-harbor" },
};

export const WithLegBadges: Story = {
  args: { locationSlug: "port-tressler" },
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="accent" size="sm">
        Pickup
      </Badge>
      <OutdoorFreightBadge {...args} />
    </div>
  ),
};
