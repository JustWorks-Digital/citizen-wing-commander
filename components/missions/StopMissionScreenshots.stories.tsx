import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StopMissionScreenshots } from "./StopMissionScreenshots";

const meta = {
  title: "Missions/StopMissionScreenshots",
  component: StopMissionScreenshots,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof StopMissionScreenshots>;

export default meta;
type Story = StoryObj<typeof meta>;

const galleryRefs = [
  {
    logicalPath: "demo/lorville-a.png",
    filename: "lorville-a.png",
    label: "lorville-a",
    missionTitles: ["Member Rank — Corundum"],
    captions: [
      "Member Rank — Corundum\n12 SCU Corundum · Everus Harbor → Lorville",
    ],
    url: "/images/outdoor-freight-elevators/port-tressler.jpg",
  },
  {
    logicalPath: "demo/lorville-b.png",
    filename: "lorville-b.png",
    label: "lorville-b",
    missionTitles: ["Member Rank — Quartz"],
    captions: [
      "Member Rank — Quartz\n8 SCU Quartz · Everus Harbor → Lorville",
    ],
    url: "/images/outdoor-freight-elevators/port-tressler.jpg",
  },
  {
    logicalPath: "demo/lorville-c.png",
    filename: "lorville-c.png",
    label: "lorville-c",
    missionTitles: ["Member Rank — Tin"],
    captions: ["Member Rank — Tin\n16 SCU Tin · Everus Harbor → Lorville"],
    url: "/images/outdoor-freight-elevators/port-tressler.jpg",
  },
];

export const SourceButton: Story = {
  args: {
    refs: galleryRefs,
  },
};

export const InlineBesideLabel: Story = {
  args: {
    refs: galleryRefs,
    variant: "inline",
  },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
        <Story />
        <span>Contracts (3)</span>
      </div>
    ),
  ],
};

export const TextOnlyPaths: Story = {
  args: {
    refs: [
      {
        logicalPath: "demo-batch/lorville-stims.png",
        filename: "lorville-stims.png",
        label: "lorville-stims",
        missionTitles: ["Junior Rank — Stims"],
        captions: ["Junior Rank — Stims\n24 SCU Stims · Lorville → Orinth"],
        url: null,
      },
      {
        logicalPath: "demo-batch/everus-quartz.png",
        filename: "everus-quartz.png",
        label: "everus-quartz",
        missionTitles: ["Direct Medium Cargo Haul"],
        captions: [
          "Direct Medium Cargo Haul\n32 SCU Quartz · Everus Harbor → Port Tressler",
        ],
        url: null,
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    refs: [],
  },
};
