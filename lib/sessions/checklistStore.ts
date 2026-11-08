import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  applySessionCompletionTiming,
  mockSessionChecklist,
  type HaulingChecklistRow,
  type SessionChecklistModel,
} from "@/lib/missions/mockSession";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "active-checklist.json");

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

  return applySessionCompletionTiming({
    sessionName: raw.sessionName?.trim() || mockSessionChecklist.sessionName,
    shipSlugs: Array.isArray(raw.shipSlugs) ? raw.shipSlugs : [],
    startedAt,
    completedAt:
      typeof raw.completedAt === "string" ? raw.completedAt : null,
    updatedAt,
    rows: Array.isArray(raw.rows) ? raw.rows : [],
  });
}

export function checklistEtag(session: SessionChecklistModel): string {
  const basis = session.updatedAt || JSON.stringify(session);
  const hash = createHash("sha1").update(basis).digest("hex").slice(0, 16);
  return `"${hash}"`;
}

async function ensureStore(): Promise<SessionChecklistModel> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<SessionChecklistModel>;
    const session = normalizeSession(parsed);
    if (
      !parsed.startedAt ||
      !parsed.updatedAt ||
      !Array.isArray(parsed.shipSlugs)
    ) {
      await writeFile(
        STORE_PATH,
        `${JSON.stringify(session, null, 2)}\n`,
        "utf8",
      );
    }
    return session;
  } catch {
    await mkdir(DATA_DIR, { recursive: true });
    const seed = normalizeSession(structuredClone(mockSessionChecklist), {
      touchUpdatedAt: true,
    });
    await writeFile(STORE_PATH, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
    return seed;
  }
}

export async function getChecklistSession(): Promise<SessionChecklistModel> {
  return ensureStore();
}

export async function saveChecklistSession(
  session: SessionChecklistModel,
): Promise<SessionChecklistModel> {
  const normalized = normalizeSession(session, { touchUpdatedAt: true });
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    STORE_PATH,
    `${JSON.stringify(normalized, null, 2)}\n`,
    "utf8",
  );
  return normalized;
}

export async function replaceChecklistRows(
  rows: HaulingChecklistRow[],
  sessionName?: string,
): Promise<SessionChecklistModel> {
  const current = await ensureStore();
  return saveChecklistSession({
    ...current,
    sessionName: sessionName?.trim() || current.sessionName,
    rows,
  });
}

export async function setLegCompleted(
  rowId: string,
  isCompleted: boolean,
): Promise<SessionChecklistModel> {
  const current = await ensureStore();
  const rows = current.rows.map((row) =>
    row.id === rowId ? { ...row, isCompleted } : row,
  );
  return saveChecklistSession({ ...current, rows });
}

export async function setSessionName(
  sessionName: string,
): Promise<SessionChecklistModel> {
  const current = await ensureStore();
  return saveChecklistSession({
    ...current,
    sessionName: sessionName.trim() || current.sessionName,
  });
}

export async function setSessionShips(
  shipSlugs: string[],
): Promise<SessionChecklistModel> {
  const current = await ensureStore();
  return saveChecklistSession({
    ...current,
    shipSlugs,
  });
}
