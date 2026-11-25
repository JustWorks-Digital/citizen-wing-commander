import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SessionTripSideNav } from "./SessionTripSideNav";

const meta = {
  title: "Missions/SessionTripSideNav",
  component: SessionTripSideNav,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Trip setup chrome. Incomplete (forceExpanded panel): stays inline until name, start, and ship are set. Complete: Setup button opens this as a modal.",
      },
    },
  },
} satisfies Meta<typeof SessionTripSideNav>;

export default meta;
type Story = StoryObj<typeof meta>;

function Interactive(args: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation?: "panel" | "modal";
  forceExpanded?: boolean;
}) {
  const [open, setOpen] = useState(args.open);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {args.presentation === "modal" ? (
        <button
          type="button"
          className="inline-flex h-9 w-fit items-center rounded-rsi border border-rsi-border px-3 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-rsi-text-secondary"
          onClick={() => {
            const next = !open;
            setOpen(next);
            args.onOpenChange(next);
          }}
        >
          Setup
        </button>
      ) : null}
      <SessionTripSideNav
        open={open}
        presentation={args.presentation}
        forceExpanded={args.forceExpanded}
        onOpenChange={(next) => {
          setOpen(next);
          args.onOpenChange(next);
        }}
        header={
          <div className="min-w-0">
            <p className="text-sm font-semibold text-rsi-text">
              Hurston Covalex run
            </p>
            <p className="mt-1 font-mono text-[0.6rem] text-rsi-text-muted">
              ID demo-session
            </p>
          </div>
        }
        collapsedLabel={
          <p className="truncate text-sm font-semibold text-rsi-text">
            Hurston Covalex run
          </p>
        }
      >
        <p className="text-sm text-rsi-text-secondary">Ship · start</p>
      </SessionTripSideNav>
      {args.presentation !== "modal" ? (
        <p className="rounded-rsi border border-rsi-border bg-rsi-bg-deep/30 p-4 text-sm text-rsi-text-secondary">
          Checklist / Progress sit below the trip section.
        </p>
      ) : null}
    </div>
  );
}

export const SetupIncomplete: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    children: null,
    presentation: "panel",
    forceExpanded: true,
  },
  render: (args) => (
    <Interactive
      open={args.open}
      onOpenChange={args.onOpenChange}
      presentation="panel"
      forceExpanded
    />
  ),
};

export const Modal: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    children: null,
    presentation: "modal",
  },
  render: (args) => (
    <Interactive
      open={args.open}
      onOpenChange={args.onOpenChange}
      presentation="modal"
    />
  ),
};
