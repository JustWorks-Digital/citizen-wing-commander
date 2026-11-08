import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState, type ComponentProps } from "react";
import { SessionScreenshotsPanel } from "./SessionScreenshotsPanel";

const meta = {
  title: "Missions/SessionScreenshotsPanel",
  component: SessionScreenshotsPanel,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    open: true,
    sessionId: "story-session",
    onClose: () => {},
    initialScreenshots: [],
  },
} satisfies Meta<typeof SessionScreenshotsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

function Interactive(args: ComponentProps<typeof SessionScreenshotsPanel>) {
  const [open, setOpen] = useState(args.open);
  return (
    <div className="min-h-[60vh] bg-rsi-bg p-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 px-4 py-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text"
      >
        Screenshots
      </button>
      <SessionScreenshotsPanel
        {...args}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

export const Empty: Story = {
  render: (args) => <Interactive {...args} />,
};

export const WithShots: Story = {
  args: {
    initialScreenshots: [
      {
        logicalPath: "story-session/contract-stims.png",
        filename: "contract-stims.png",
        bytes: 184_320,
        mtime: "2026-11-08T06:00:00.000Z",
        url: "https://placehold.co/640x360/1c2737/54adf7?text=Stims",
      },
      {
        logicalPath: "story-session/contract-tin.png",
        filename: "contract-tin.png",
        bytes: 201_100,
        mtime: "2026-11-08T06:01:00.000Z",
        url: "https://placehold.co/640x360/1c2737/3dbf8f?text=Tin",
      },
    ],
  },
  render: (args) => <Interactive {...args} />,
};
