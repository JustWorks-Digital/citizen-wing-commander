import { readFileSync } from "node:fs";
import path from "node:path";
import type { APIRequestContext } from "@playwright/test";

const root = process.cwd();

function assertLocalBaseUrl(baseURL: string) {
  const host = new URL(baseURL).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error(
      `Refusing to seed fixture against non-local host (${host}). Use PLAYWRIGHT_BASE_URL only for read-only prod runs without seed.`,
    );
  }
}

/** PUT session.json into local `/api/checklist` (same as restore script). */
export async function seedSessionFixture(
  request: APIRequestContext,
  slug: string,
  baseURL: string,
): Promise<{ sessionId: string; sessionName: string }> {
  assertLocalBaseUrl(baseURL);
  const sessionPath = path.join(
    root,
    "tests/sessions",
    slug,
    "session.json",
  );
  const session = JSON.parse(readFileSync(sessionPath, "utf8")) as {
    id: string;
    sessionName?: string;
  };
  const sessionId = session.id;
  const res = await request.put(`/api/checklist?sessionId=${encodeURIComponent(sessionId)}`, {
    data: {
      ...session,
      updatedAt: new Date().toISOString(),
    },
  });
  if (!res.ok()) {
    const text = await res.text();
    throw new Error(`Seed failed ${res.status()}: ${text.slice(0, 400)}`);
  }
  return {
    sessionId,
    sessionName: session.sessionName?.trim() || "Trip",
  };
}
