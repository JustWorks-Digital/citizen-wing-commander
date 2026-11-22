import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  ChecklistProgressRail,
  ChecklistProgressTimeline,
  CompletedStopHistoryRow,
  FinishRunTile,
} from "./CompletedHistoryRow";

const meta = {
  title: "Missions/Checklist/CompletedHistoryRow",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Completed history strip, progress timeline, and last-stop finish tile.",
      },
    },
  },
} satisfies Meta;

export default meta;

type TimelineStory = StoryObj<typeof ChecklistProgressTimeline>;

export const ProgressTimeline: TimelineStory = {
  render: (args) => (
    <div className="rounded-rsi border border-rsi-border bg-rsi-bg-deep/35">
      <ChecklistProgressTimeline {...args} />
    </div>
  ),
  args: {
    onSelectStop: () => {},
    stops: [
      {
        id: "1",
        locationSlug: "everus-harbor",
        step: 1,
        isCompleted: true,
        isCurrent: false,
        isViewing: false,
      },
      {
        id: "2",
        locationSlug: "covalex-distribution-centre-s1dc06",
        step: 2,
        isCompleted: true,
        isCurrent: false,
        isViewing: true,
      },
      {
        id: "3",
        locationSlug: "hdpc-farnesway",
        step: 3,
        isCompleted: false,
        isCurrent: true,
        isViewing: false,
      },
      {
        id: "4",
        locationSlug: "hdpc-cassillo",
        step: 4,
        isCompleted: false,
        isCurrent: false,
        isViewing: false,
      },
      {
        id: "5",
        locationSlug: "lorville",
        step: 5,
        isCompleted: false,
        isCurrent: false,
        isViewing: false,
      },
    ],
  },
};

export const CompletedStrip: StoryObj<typeof CompletedStopHistoryRow> = {
  render: (args) => <CompletedStopHistoryRow {...args} />,
  args: {
    location: "Everus Harbor",
    step: 1,
    routeAction: "pickup",
    scuTotal: 121,
    isFocused: false,
    isPending: false,
    onToggle: () => {},
    onOpen: () => {},
  },
};

export const ProgressRail: StoryObj<typeof ChecklistProgressRail> = {
  render: (args) => (
    <div className="flex items-start gap-4">
      <div className="lg:block">
        <ChecklistProgressRail
          {...args}
          matchHeightEl={null}
        />
      </div>
      <div className="h-[28rem] flex-1 rounded-rsi border border-rsi-border bg-rsi-bg-deep/40 p-4 text-sm text-rsi-text-muted">
        Checklist height stand-in (rail matches live in the app).
      </div>
    </div>
  ),
  args: {
    progressDone: 2,
    progressTotal: 5,
    matchHeightEl: null,
    onSelectStop: () => {},
    stops: [
      {
        id: "1",
        locationSlug: "everus-harbor",
        step: 1,
        isCompleted: true,
        isCurrent: false,
        isViewing: false,
      },
      {
        id: "2",
        locationSlug: "covalex-distribution-centre-s1dc06",
        step: 2,
        isCompleted: true,
        isCurrent: false,
        isViewing: false,
      },
      {
        id: "3",
        locationSlug: "hdpc-farnesway",
        step: 3,
        isCompleted: false,
        isCurrent: true,
        isViewing: false,
      },
      {
        id: "4",
        locationSlug: "hdpc-cassillo",
        step: 4,
        isCompleted: false,
        isCurrent: false,
        isViewing: false,
      },
      {
        id: "5",
        locationSlug: "lorville",
        step: 5,
        isCompleted: false,
        isCurrent: false,
        isViewing: false,
      },
      {
        id: "6",
        locationSlug: "area18",
        step: 6,
        isCompleted: false,
        isCurrent: false,
        isViewing: false,
      },
      {
        id: "7",
        locationSlug: "baijini-point",
        step: 7,
        isCompleted: false,
        isCurrent: false,
        isViewing: false,
      },
    ],
  },
};

export const FinishRun: StoryObj<typeof FinishRunTile> = {
  render: (args) => (
    <div className="flex justify-end rounded-rsi border border-rsi-border bg-rsi-surface/80 p-3">
      <FinishRunTile {...args} />
    </div>
  ),
  args: {
    location: "Orison",
    step: 4,
    isCompleted: false,
    isActive: true,
    isPending: false,
    onToggle: () => {},
  },
};

export const FinishRunCompleted: StoryObj<typeof FinishRunTile> = {
  render: (args) => (
    <div className="flex justify-end rounded-rsi border border-rsi-border bg-rsi-surface/80 p-3">
      <FinishRunTile {...args} />
    </div>
  ),
  args: {
    location: "Orison",
    step: 4,
    isCompleted: true,
    isActive: true,
    isPending: false,
    onToggle: () => {},
    onOpenSummary: () => {},
  },
};
