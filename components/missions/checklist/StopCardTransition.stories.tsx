"use client";

import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/Button";
import {
  StopBodyReveal,
  type StopBodyMotion,
} from "./StopCardTransition";

const meta = {
  title: "Missions/Checklist/StopBodyReveal",
  component: StopBodyReveal,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Accordion stop body motion: open/closed idle, slide-up leave, slide-down enter. Used for Done handoff and tab focus between stops.",
      },
    },
  },
} satisfies Meta<typeof StopBodyReveal>;

export default meta;
type Story = StoryObj<typeof meta>;

function DemoBody({ label }: { label: string }) {
  return (
    <div className="space-y-2 border-t border-rsi-divider/60 bg-rsi-bg-deep/30 px-3 py-4 text-sm text-rsi-text-secondary">
      <p className="font-medium text-rsi-text">{label}</p>
      <p>Pickup / delivery lines and bay pad live here in the live checklist.</p>
    </div>
  );
}

function StopShell({
  motion,
  children,
  caption,
}: {
  motion: StopBodyMotion;
  children: React.ReactNode;
  caption: string;
}) {
  return (
    <div className="max-w-lg overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface/90">
      <div className="px-3 py-1.5 text-[0.7rem] text-rsi-text-secondary">
        {caption}
      </div>
      <StopBodyReveal motion={motion}>{children}</StopBodyReveal>
    </div>
  );
}

export const Open: Story = {
  args: {
    motion: "open",
    children: <DemoBody label="Open stop" />,
  },
  render: (args) => (
    <StopShell motion={args.motion} caption="Everus Harbor">
      {args.children}
    </StopShell>
  ),
};

export const Closed: Story = {
  args: {
    motion: "closed",
    children: <DemoBody label="Closed stop" />,
  },
  render: (args) => (
    <StopShell motion={args.motion} caption="Everus Harbor">
      {args.children}
    </StopShell>
  ),
};

function SlideDemo() {
  const [motion, setMotion] = useState<StopBodyMotion>("open");
  return (
    <div className="flex max-w-lg flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["slide-up", "Slide up"],
            ["slide-down", "Slide down"],
            ["open", "Open"],
            ["closed", "Closed"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant="secondary"
            className="!px-3 !py-1.5 !text-[0.65rem]"
            onClick={() => setMotion(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <StopShell motion={motion} caption={`Motion: ${motion}`}>
        <DemoBody label="Animated body" />
      </StopShell>
    </div>
  );
}

export const Interactive: Story = {
  args: {
    motion: "open",
    children: <DemoBody label="Animated body" />,
  },
  render: () => <SlideDemo />,
};
