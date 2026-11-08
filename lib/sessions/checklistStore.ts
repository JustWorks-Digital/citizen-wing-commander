import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  applySessionCompletionTiming,
  mockSessionChecklist,
  type HaulingChecklistRow,
  type SessionChecklistModel,
  type SessionMission,
} from "@/lib/missions/mockSession";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "active-checklist.json");

export type SessionTabSummary = {
  id: string;
  sessionName: string;
  updatedAt: string;
  missionCount: number;
  rowCount: number;
};

export type ChecklistStoreFile = {
  activeSessionId: string;
  sessions: SessionChecklistModel[];
};

/** Short stable id for tabs / MCP (`sessionId`). */
export function createSessionId(): string {
  return randomBytes(4).toString("hex");
}

export function emptySessionChecklist(
  overrides?: Partial<SessionChecklistModel>,
): SessionChecklistModel {
  const now = new Date().toISOString();
  return normalizeSession({
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

function normalizeSession(
  raw: Partial<SessionChecklistModel> & {
    sessionName?: string;
    rows?: HaulingChecklistRow[];
  },
  options?: { touchUpdatedAt?: boolean },
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
  const id =
    typeof raw.id === "string" && /^[a-z0-9_-]{4,32}$/i.test(raw.id.trim())
      ? raw.id.trim()
      : createSessionId();

  return applySessionCompletionTiming({
    id,
    sessionName: raw.sessionName?.trim() || mockSessionChecklist.sessionName,
    shipSlugs: Array.isArray(raw.shipSlugs) ? raw.shipSlugs : [],
    startLocationSlug:
      typeof raw.startLocationSlug === "string" && raw.startLocationSlug.trim()
        ? raw.startLocationSlug.trim()
        : null,
    missionCount: (() => {
      const total = Math.max(
        0,
        Math.trunc(
          typeof raw.missionCount === "number" && Number.isFinite(raw.missionCount)
            ? raw.missionCount
            : 0,
        ),
      );
      return total;
    })(),
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

function isLegacySessionBlob(raw: unknown): raw is Partial<SessionChecklistModel> {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  return (
    !Array.isArray(obj.sessions) &&
    (typeof obj.sessionName === "string" || Array.isArray(obj.rows))
  );
}

function summarize(session: SessionChecklistModel): SessionTabSummary {
  return {
    id: session.id,
    sessionName: session.sessionName,
    updatedAt: session.updatedAt,
    missionCount: session.missionCount,
    rowCount: session.rows.length,
  };
}

async function writeStore(store: ChecklistStoreFile): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function readStoreRaw(): Promise<unknown | null> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

async function ensureStore(): Promise<ChecklistStoreFile> {
  const parsed = await readStoreRaw();
  if (parsed == null) {
    const seed = normalizeSession(structuredClone(mockSessionChecklist), {
      touchUpdatedAt: true,
    });
    const store: ChecklistStoreFile = {
      activeSessionId: seed.id,
      sessions: [seed],
    };
    await writeStore(store);
    return store;
  }

  if (isLegacySessionBlob(parsed)) {
    const session = normalizeSession(parsed);
    const store: ChecklistStoreFile = {
      activeSessionId: session.id,
      sessions: [session],
    };
    await writeStore(store);
    return store;
  }

  const obj = parsed as Partial<ChecklistStoreFile>;
  const rawSessions = Array.isArray(obj.sessions) ? obj.sessions : [];
  const sessions = rawSessions.map((row) => normalizeSession(row));
  if (sessions.length === 0) {
    const seed = emptySessionChecklist({ sessionName: "New session" });
    const store: ChecklistStoreFile = {
      activeSessionId: seed.id,
      sessions: [seed],
    };
    await writeStore(store);
    return store;
  }

  const activeSessionId =
    typeof obj.activeSessionId === "string" &&
    sessions.some((s) => s.id === obj.activeSessionId)
      ? obj.activeSessionId
      : sessions[0]!.id;

  const store: ChecklistStoreFile = { activeSessionId, sessions };
  const needsPersist =
    activeSessionId !== obj.activeSessionId ||
    sessions.some((session, index) => {
      const raw = rawSessions[index] as Partial<SessionChecklistModel> | undefined;
      return !raw?.id || raw.id !== session.id;
    });
  if (needsPersist) {
    await writeStore(store);
  }
  return store;
}

function requireSession(
  store: ChecklistStoreFile,
  sessionId?: string | null,
): SessionChecklistModel {
  const id = sessionId?.trim() || store.activeSessionId;
  const found = store.sessions.find((s) => s.id === id);
  if (!found) {
    throw new Error(`Unknown session id: ${id}`);
  }
  return found;
}

export function checklistEtag(session: SessionChecklistModel): string {
  const basis = `${session.id}:${session.updatedAt}` || JSON.stringify(session);
  const hash = createHash("sha1").update(basis).digest("hex").slice(0, 16);
  return `"${hash}"`;
}

export async function listChecklistSessions(): Promise<{
  activeSessionId: string;
  sessions: SessionTabSummary[];
}> {
  const store = await ensureStore();
  return {
    activeSessionId: store.activeSessionId,
    sessions: store.sessions.map(summarize),
  };
}

export async function getChecklistSession(
  sessionId?: string | null,
): Promise<SessionChecklistModel> {
  const store = await ensureStore();
  return requireSession(store, sessionId);
}

export async function setActiveChecklistSession(
  sessionId: string,
): Promise<SessionChecklistModel> {
  const store = await ensureStore();
  const session = requireSession(store, sessionId);
  store.activeSessionId = session.id;
  await writeStore(store);
  return session;
}

export async function createChecklistSession(input?: {
  sessionName?: string;
  activate?: boolean;
}): Promise<SessionChecklistModel> {
  const store = await ensureStore();
  const session = emptySessionChecklist({
    sessionName: input?.sessionName?.trim() || "New session",
  });
  store.sessions.push(session);
  if (input?.activate !== false) {
    store.activeSessionId = session.id;
  }
  await writeStore(store);
  return session;
}

export async function saveChecklistSession(
  session: SessionChecklistModel,
): Promise<SessionChecklistModel> {
  const store = await ensureStore();
  const normalized = normalizeSession(session, { touchUpdatedAt: true });
  const idx = store.sessions.findIndex((s) => s.id === normalized.id);
  if (idx >= 0) {
    store.sessions[idx] = normalized;
  } else if (store.sessions.length === 1 && !session.id) {
    // Legacy PUT without id → overwrite active
    const active = requireSession(store);
    const merged = normalizeSession(
      { ...normalized, id: active.id },
      { touchUpdatedAt: true },
    );
    store.sessions = [merged];
    store.activeSessionId = merged.id;
    await writeStore(store);
    return merged;
  } else {
    store.sessions.push(normalized);
    store.activeSessionId = normalized.id;
  }
  await writeStore(store);
  return normalized;
}

export async function replaceChecklistRows(
  rows: HaulingChecklistRow[],
  sessionName?: string,
  options?: {
    sessionId?: string | null;
    resetTimer?: boolean;
    shipSlugs?: string[];
    missionCount?: number;
    missionsCompleted?: number;
    missions?: SessionMission[];
  },
): Promise<SessionChecklistModel> {
  const current = await getChecklistSession(options?.sessionId);
  const now = new Date().toISOString();
  const missions =
    options?.missions !== undefined ? options.missions : current.missions;
  const missionCount =
    options?.missionCount !== undefined
      ? options.missionCount
      : options?.missions !== undefined
        ? options.missions.length
        : current.missionCount;
  return saveChecklistSession({
    ...current,
    sessionName: sessionName?.trim() || current.sessionName,
    shipSlugs:
      options?.shipSlugs !== undefined ? options.shipSlugs : current.shipSlugs,
    missionCount,
    missionsCompleted:
      options?.missionsCompleted !== undefined
        ? options.missionsCompleted
        : options?.resetTimer
          ? 0
          : current.missionsCompleted,
    missions,
    startedAt: options?.resetTimer ? now : current.startedAt,
    completedAt: options?.resetTimer ? null : current.completedAt,
    rows,
  });
}

export async function setLegCompleted(
  rowId: string,
  isCompleted: boolean,
  sessionId?: string | null,
): Promise<SessionChecklistModel> {
  const current = await getChecklistSession(sessionId);
  const rows = current.rows.map((row) =>
    row.id === rowId ? { ...row, isCompleted } : row,
  );
  return saveChecklistSession({ ...current, rows });
}

export async function setSessionName(
  sessionName: string,
  sessionId?: string | null,
): Promise<SessionChecklistModel> {
  const current = await getChecklistSession(sessionId);
  return saveChecklistSession({
    ...current,
    sessionName: sessionName.trim() || current.sessionName,
  });
}

export async function setSessionShips(
  shipSlugs: string[],
  sessionId?: string | null,
): Promise<SessionChecklistModel> {
  const current = await getChecklistSession(sessionId);
  return saveChecklistSession({
    ...current,
    shipSlugs,
  });
}

export async function setSessionStartLocation(
  startLocationSlug: string | null,
  sessionId?: string | null,
): Promise<SessionChecklistModel> {
  const current = await getChecklistSession(sessionId);
  return saveChecklistSession({
    ...current,
    startLocationSlug,
  });
}
