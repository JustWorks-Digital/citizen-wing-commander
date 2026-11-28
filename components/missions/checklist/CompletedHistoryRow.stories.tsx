import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import {
  ChecklistProgressRail,
  ChecklistProgressTimeline,
  CompletedQuantumHistoryRow,
  CompletedStopHistoryRow,
  FinishRunTile,
  NextDistanceMeta,
} from "./CompletedHistoryRow";

const meta = {
  title: "Missions/Checklist/CompletedHistoryRow",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Completed history strip, progress timeline (double chevrons between stops — right on horizontal, down on vertical; vertical Stops rail uses tighter thumb/connector padding; Current overlays the thumb on mobile only — desktop uses accent ring; Next overlays on vertical), last-stop finish tile, and next-stop Done trail (hover waves L→R; pending/blue keeps the wave in accent; complete is static green). Completed quantum strips match closed stop accordion tabs (0.7rem title, Quantum badge, hop mono) and omit the Done checkmark.",
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

export const ProgressTimelineVertical: TimelineStory = {
  ...ProgressTimeline,
  args: {
    ...ProgressTimeline.args,
    orientation: "vertical",
  },
  render: (args) => (
    <div className="w-36 rounded-rsi border border-rsi-border bg-rsi-bg-deep/35">
      <ChecklistProgressTimeline {...args} />
    </div>
  ),
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

export const CompletedQuantumStrip: StoryObj<typeof CompletedQuantumHistoryRow> =
  {
    render: (args) => <CompletedQuantumHistoryRow {...args} />,
    args: {
      fromLabel: "Everus Harbor",
      toLabel: "Baijini Point",
      hopLabel: "12.4 Mm",
      hopTitle: "12.4 Mm",
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
        Checklist height stand-in (live rail caps to a high-water match so
        collapsing the open stop does not shrink Stops).
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

const nextStopRow = {
  id: "leg-1",
  locationSlug: "everus-harbor",
  isCompleted: false,
  distanceToNext: null,
} as HaulingChecklistRow;

/** Hover the Done checkbox — chevrons pulse left→right in a loop. */
export const DoneChevronWave: StoryObj<typeof NextDistanceMeta> = {
  render: (args) => (
    <div className="rounded-rsi border border-rsi-border bg-rsi-surface/80 px-3 py-2">
      <NextDistanceMeta {...args} />
    </div>
  ),
  args: {
    row: nextStopRow,
    nextLocationName: "Covalex Distribution Centre S1DC06",
    nextLocationSlug: "covalex-distribution-centre-s1dc06",
    shipSlug: "galaxy",
    variant: "header",
    locationLabel: "Everus Harbor",
    step: 1,
    isActive: true,
    isPending: false,
    onToggle: () => {},
  },
};

/** Pending (blue) Done — same L→R wave, accent color, no hover required. */
export const DoneChevronWavePending: StoryObj<typeof NextDistanceMeta> = {
  ...DoneChevronWave,
  args: {
    ...DoneChevronWave.args,
    isPending: true,
  },
};

/** Optimistic complete still pending — keep blue wave until save settles. */
export const DoneChevronWavePendingOptimistic: StoryObj<typeof NextDistanceMeta> = {
  ...DoneChevronWave,
  args: {
    ...DoneChevronWave.args,
    row: { ...nextStopRow, isCompleted: true },
    isPending: true,
  },
};

/** Complete — green trail stays static (no wave). */
export const DoneChevronCompleteStatic: StoryObj<typeof NextDistanceMeta> = {
  ...DoneChevronWave,
  args: {
    ...DoneChevronWave.args,
    row: { ...nextStopRow, isCompleted: true },
    isPending: false,
  },
};
