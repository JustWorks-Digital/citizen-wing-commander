import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { SessionTabs } from "./SessionTabs";

const demoSessions = [
  {
    id: "a1b2c3d4",
    sessionName: "Hurston Covalex run",
    updatedAt: "2026-11-08T05:00:00.000Z",
    missionCount: 4,
    rowCount: 5,
  },
  {
    id: "e5f60718",
    sessionName: "Stanton hauling run",
    updatedAt: "2026-11-08T04:00:00.000Z",
    missionCount: 1,
    rowCount: 4,
  },
];

const meta = {
  title: "Missions/SessionTabs",
  component: SessionTabs,
  parameters: {
    layout: "padded",
  },
  args: {
    sessions: demoSessions,
    activeSessionId: "a1b2c3d4",
    onSelect: () => undefined,
    onCreate: () => undefined,
  },
} satisfies Meta<typeof SessionTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Interactive: Story = {
  render: () => {
    const [sessions, setSessions] = useState(demoSessions);
    const [activeSessionId, setActive] = useState(demoSessions[0]!.id);
    return (
      <SessionTabs
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={setActive}
        onCreate={() => {
          const id = Math.random().toString(16).slice(2, 10);
          setSessions((prev) => [
            ...prev,
            {
              id,
              sessionName: "New session",
              updatedAt: new Date().toISOString(),
              missionCount: 0,
              rowCount: 0,
            },
          ]);
          setActive(id);
        }}
      />
    );
  },
};
