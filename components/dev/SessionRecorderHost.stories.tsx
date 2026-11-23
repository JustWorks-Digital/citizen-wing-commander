import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SessionRecorderHost } from "./SessionRecorderHost";

const meta = {
  title: "Dev/SessionRecorderHost",
  component: SessionRecorderHost,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Dev UI action recorder HUD (bottom-right). Capability-gated. Press `;` to show/hide the box (persisted in localStorage across reloads); Record/Stop attaches capture listeners only while recording.",
      },
    },
  },
} satisfies Meta<typeof SessionRecorderHost>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: { enabled: true },
  render: (args) => (
    <div className="relative min-h-[40vh] bg-rsi-bg-deep p-8 text-rsi-text">
      <p className="text-sm text-rsi-text-secondary">
        Page content under the recorder HUD.
      </p>
      <button type="button" className="mt-4 text-rsi-accent" data-testid="demo-btn">
        Demo control
      </button>
      <SessionRecorderHost {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: { enabled: false },
  render: (args) => (
    <div className="relative min-h-[20vh] bg-rsi-bg-deep p-8">
      <SessionRecorderHost {...args} />
      <p className="text-sm text-rsi-text-muted">No recorder when disabled.</p>
    </div>
  ),
};
