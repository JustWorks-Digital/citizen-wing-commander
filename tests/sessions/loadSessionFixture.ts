import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SessionChecklist } from "@/lib/missions/sessionChecklist";

export type SessionFixtureMeta = {
  slug: string;
  sourceSessionId: string;
  capturedAt: string;
  notes?: string;
  assets: string[];
};

export type SessionFixtureExpectations = {
  sessionName: string;
  startLocationSlug: string | null;
  missionCount: number;
  rowCount: number;
  peakStopId: string | null;
  peakScu: number | null;
  tripCargo: {
    ok: boolean;
    issueCount: number;
  };
};

export type SessionFixturePack = {
  slug: string;
  dir: string;
  meta: SessionFixtureMeta;
  session: SessionChecklist;
  expectations: SessionFixtureExpectations;
  assetsDir: string;
};

const sessionsRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
);

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

/** Load a curated pack from `tests/sessions/<slug>/`. */
export function loadSessionFixture(slug: string): SessionFixturePack {
  const dir = path.join(sessionsRoot, slug);
  const meta = readJson<SessionFixtureMeta>(path.join(dir, "meta.json"));
  const session = readJson<SessionChecklist>(path.join(dir, "session.json"));
  const expectations = readJson<SessionFixtureExpectations>(
    path.join(dir, "expectations.json"),
  );
  return {
    slug: meta.slug || slug,
    dir,
    meta,
    session,
    expectations,
    assetsDir: path.join(dir, "assets"),
  };
}
