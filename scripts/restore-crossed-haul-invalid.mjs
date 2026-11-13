#!/usr/bin/env node
/**
 * Restore the crossed-haul invalid session backup into local (or APP_BASE_URL).
 *
 *   npm run fixtures:restore-crossed-haul-invalid
 *   APP_BASE_URL=http://localhost:3000 npm run fixtures:restore-crossed-haul-invalid
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = join(
  root,
  "lib/fixtures/sessions/crossed-haul-invalid-2026-11-13/session.json",
);
const session = JSON.parse(readFileSync(fixturePath, "utf8"));
const sessionId = session.id;
const base =
  (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const url = `${base}/api/checklist?sessionId=${encodeURIComponent(sessionId)}`;

const body = {
  ...session,
  updatedAt: new Date().toISOString(),
};

const res = await fetch(url, {
  method: "PUT",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify(body),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Restore failed ${res.status}: ${text.slice(0, 500)}`);
  process.exit(1);
}

let saved;
try {
  saved = JSON.parse(text);
} catch {
  console.error("Restore returned non-JSON:", text.slice(0, 300));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      sessionId: saved.id,
      sessionName: saved.sessionName,
      missionCount: saved.missionCount,
      rowCount: Array.isArray(saved.rows) ? saved.rows.length : 0,
      startLocationSlug: saved.startLocationSlug ?? null,
    },
    null,
    2,
  ),
);
