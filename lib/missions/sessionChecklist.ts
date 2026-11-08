import {
  applySessionCompletionTiming,
  type HaulingChecklistRow,
  type SessionChecklistModel,
  type SessionMission,
} from "@/lib/missions/mockSession";

export type SessionTabSummary = {
  id: string;
  sessionName: string;
  updatedAt: string;
  missionCount: number;
  rowCount: number;
};

/** UUID for DB row + MCP `sessionId` (works in Node + browser). */
export function createSessionId(): string {
  return crypto.randomUUID();
}

export function emptySessionChecklist(
  overrides?: Partial<SessionChecklistModel>,
): SessionChecklistModel {
  const now = new Date().toISOString();
  return normalizeSessionChecklist({
    id: createSessionId(),
    sessionName: "New session",
    shipSlugs: [],
    startLocationSlug: null,
    missionCount: 0,
    missionsCompleted: 0,
    missions: [],
    startedAt: now,
    completedAt: null,
    updatedAt: now,
    rows: [],
    ...overrides,
  });
}

export function normalizeSessionChecklist(
  raw: Partial<SessionChecklistModel> & {
    sessionName?: string;
    rows?: HaulingChecklistRow[];
  },
  options?: { touchUpdatedAt?: boolean; preferId?: string },
): SessionChecklistModel {
  const startedAt =
    typeof raw.startedAt === "string" && raw.startedAt
      ? raw.startedAt
      : new Date().toISOString();
  const updatedAt =
    options?.touchUpdatedAt ||
    typeof raw.updatedAt !== "string" ||
    !raw.updatedAt
      ? new Date().toISOString()
      : raw.updatedAt;
  const idCandidate =
    (typeof options?.preferId === "string" && options.preferId.trim()) ||
    (typeof raw.id === "string" && raw.id.trim()) ||
    "";
  const id =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      idCandidate,
    ) || /^[a-z0-9_-]{4,64}$/i.test(idCandidate)
      ? idCandidate
      : createSessionId();

  return applySessionCompletionTiming({
    id,
    sessionName: raw.sessionName?.trim() || "New session",
    shipSlugs: Array.isArray(raw.shipSlugs) ? raw.shipSlugs : [],
    startLocationSlug:
      typeof raw.startLocationSlug === "string" && raw.startLocationSlug.trim()
        ? raw.startLocationSlug.trim()
        : null,
    missionCount: Math.max(
      0,
      Math.trunc(
        typeof raw.missionCount === "number" && Number.isFinite(raw.missionCount)
          ? raw.missionCount
          : 0,
      ),
    ),
    missionsCompleted: (() => {
      const total = Math.max(
        0,
        Math.trunc(
          typeof raw.missionCount === "number" && Number.isFinite(raw.missionCount)
            ? raw.missionCount
            : 0,
        ),
      );
      const done = Math.max(
        0,
        Math.trunc(
          typeof raw.missionsCompleted === "number" &&
            Number.isFinite(raw.missionsCompleted)
            ? raw.missionsCompleted
            : 0,
        ),
      );
      return Math.min(done, total);
    })(),
    missions: Array.isArray(raw.missions)
      ? (raw.missions as SessionMission[])
      : [],
    startedAt,
    completedAt:
      typeof raw.completedAt === "string" ? raw.completedAt : null,
    updatedAt,
    rows: Array.isArray(raw.rows) ? raw.rows : [],
  });
}

export function summarizeSessionChecklist(
  session: SessionChecklistModel,
): SessionTabSummary {
  return {
    id: session.id,
    sessionName: session.sessionName,
    updatedAt: session.updatedAt,
    missionCount: session.missionCount,
    rowCount: session.rows.length,
  };
}
