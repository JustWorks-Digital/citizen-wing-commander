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
  {
    id: "f9a0b1c2",
    sessionName: "Pyro shuttle legs",
    updatedAt: "2026-11-08T03:00:00.000Z",
    missionCount: 2,
    rowCount: 3,
  },
  {
    id: "d3e4f506",
    sessionName: "MicroTech ice haul",
    updatedAt: "2026-11-07T22:00:00.000Z",
    missionCount: 3,
    rowCount: 6,
  },
  {
    id: "778899aa",
    sessionName: "ArcCorp waste run",
    updatedAt: "2026-11-07T18:00:00.000Z",
    missionCount: 1,
    rowCount: 2,
  },
];

const meta = {
  title: "Missions/SessionTabs",
  component: SessionTabs,
  parameters: {
    layout: "padded",
  },
  args: {
    sessions: demoSessions.slice(0, 2),
    activeSessionId: "a1b2c3d4",
    onSelect: () => undefined,
    onCreate: () => undefined,
    onClose: () => undefined,
  },
} satisfies Meta<typeof SessionTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Collapsed to 3 most recent with a “+N more” control. */
export const ManySessions: Story = {
  args: {
    sessions: demoSessions,
    activeSessionId: "a1b2c3d4",
  },
};

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
            {
              id,
              sessionName: "New session",
              updatedAt: new Date().toISOString(),
              missionCount: 0,
              rowCount: 0,
            },
            ...prev,
          ]);
          setActive(id);
        }}
        onClose={(sessionId) => {
          setSessions((prev) => {
            const next = prev.filter((tab) => tab.id !== sessionId);
            if (sessionId === activeSessionId && next[0]) {
              setActive(next[0].id);
            }
            return next;
          });
        }}
      />
    );
  },
};
