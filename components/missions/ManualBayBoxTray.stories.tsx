import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ManualBayBoxTray } from "./ManualBayBoxTray";
import type { ManualBayInventoryMissionGroup } from "@/lib/ships/manualBayInventory";

const groups: ManualBayInventoryMissionGroup[] = [
  {
    missionId: "mission-a",
    missionTitle: "Senior Medium Cargo Haul A",
    lines: [
      {
        key: "mission-a:processed-food:8",
        missionId: "mission-a",
        missionTitle: "Senior Medium Cargo Haul A",
        commoditySlug: "processed-food",
        commodityName: "Processed Food",
        size: 8,
        color: "red",
        color2: null,
        demanded: 4,
        placed: 1,
        remaining: 3,
      },
      {
        key: "mission-a:hydrogen-fuel:8",
        missionId: "mission-a",
        missionTitle: "Senior Medium Cargo Haul A",
        commoditySlug: "hydrogen-fuel",
        commodityName: "Hydrogen Fuel",
        size: 8,
        color: "white",
        color2: null,
        demanded: 2,
        placed: 2,
        remaining: 0,
      },
    ],
  },
  {
    missionId: "mission-b",
    missionTitle: "Senior Medium Cargo Haul B",
    lines: [
      {
        key: "mission-b:processed-food:8",
        missionId: "mission-b",
        missionTitle: "Senior Medium Cargo Haul B",
        commoditySlug: "processed-food",
        commodityName: "Processed Food",
        size: 8,
        color: "red",
        color2: null,
        demanded: 2,
        placed: 0,
        remaining: 2,
      },
    ],
  },
];

const meta = {
  title: "Missions/ManualBayBoxTray",
  component: ManualBayBoxTray,
  parameters: {
    docs: {
      description: {
        component:
          "Manual packing tray: remaining crates grouped by mission × commodity × SCU size. Chip aspect matches the crate’s top-down footprint (scaled so icon/text aren’t clipped). Drag onto the 2D bay grid; counts drop as crates are placed.",
      },
    },
  },
} satisfies Meta<typeof ManualBayBoxTray>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoMissions: Story = {
  args: {
    groups,
    onClearBay: () => undefined,
  },
};
