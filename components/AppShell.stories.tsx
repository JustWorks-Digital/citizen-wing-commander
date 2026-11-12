import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AppShell } from "./AppShell";

const meta = {
  title: "Layout/AppShell",
  component: AppShell,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    activeNav: "sessions",
    children: (
      <p className="text-sm text-rsi-text-secondary">Trip content</p>
    ),
  },
};

export const MissionsNav: Story = {
  args: {
    activeNav: "missions",
    children: (
      <p className="text-sm text-rsi-text-secondary">Catalog content</p>
    ),
  },
};

export const IntakeNav: Story = {
  args: {
    activeNav: "intake",
    children: (
      <p className="text-sm text-rsi-text-secondary">Intake uploads</p>
    ),
  },
};
