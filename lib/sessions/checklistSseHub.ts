import "server-only";

export type ChecklistSseEvent = {
  type: "checklist_updated";
  sessionId: string;
  updatedAt: string;
};

type Subscriber = {
  sessionId: string;
  send: (event: ChecklistSseEvent) => void;
};

type HubState = {
  subscribers: Set<Subscriber>;
};

const globalKey = "__cwcChecklistSseHub";

function getHub(): HubState {
  const g = globalThis as typeof globalThis & {
    [globalKey]?: HubState;
  };
  if (!g[globalKey]) {
    g[globalKey] = { subscribers: new Set() };
  }
  return g[globalKey];
}

/** Subscribe a live SSE connection for one session. */
export function subscribeChecklistSse(
  sessionId: string,
  send: (event: ChecklistSseEvent) => void,
): () => void {
  const id = sessionId.trim();
  if (!id) return () => {};
  const hub = getHub();
  const subscriber: Subscriber = { sessionId: id, send };
  hub.subscribers.add(subscriber);
  return () => {
    hub.subscribers.delete(subscriber);
  };
}

/** Notify all open SSE clients watching this session (best-effort). */
export function publishChecklistUpdated(
  sessionId: string,
  updatedAt: string,
): void {
  const id = sessionId.trim();
  if (!id) return;
  const event: ChecklistSseEvent = {
    type: "checklist_updated",
    sessionId: id,
    updatedAt,
  };
  const hub = getHub();
  for (const subscriber of hub.subscribers) {
    if (subscriber.sessionId !== id) continue;
    try {
      subscriber.send(event);
    } catch {
      /* drop broken senders on next abort */
    }
  }
}

/** Test / diagnostics helper. */
export function checklistSseSubscriberCount(sessionId?: string): number {
  const hub = getHub();
  if (!sessionId) return hub.subscribers.size;
  const id = sessionId.trim();
  let n = 0;
  for (const subscriber of hub.subscribers) {
    if (subscriber.sessionId === id) n += 1;
  }
  return n;
}
