import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

const root = process.cwd();

export const MICROTECH_LOCAL_HAULS_SLUG =
  "microtech-5-experienced-local-hauls-2026-11-16";

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
  const sessionPath = path.join(root, "tests/sessions", slug, "session.json");
  const session = JSON.parse(readFileSync(sessionPath, "utf8")) as {
    id: string;
    sessionName?: string;
    completedAt?: string | null;
    rows?: Array<Record<string, unknown>>;
    missions?: Array<Record<string, unknown>>;
  };
  const sessionId = session.id;
  // Always seed as an in-progress trip so completion UI from a prior run
  // cannot leave the finish dialog open over later specs.
  const rows = (session.rows ?? []).map((row) => ({
    ...row,
    isCompleted: false,
  }));
  const missions = (session.missions ?? []).map((mission) => ({
    ...mission,
    isCompleted: false,
  }));
  const now = new Date().toISOString();
  const res = await request.put(
    `/api/checklist?sessionId=${encodeURIComponent(sessionId)}`,
    {
      data: {
        ...session,
        rows,
        missions,
        // Fresh timer avoids SSR/client elapsed-label hydration mismatches
        // from ancient fixture startedAt values.
        startedAt: now,
        completedAt: null,
        missionsCompleted: 0,
        updatedAt: now,
      },
    },
  );
  if (!res.ok()) {
    const text = await res.text();
    throw new Error(`Seed failed ${res.status()}: ${text.slice(0, 400)}`);
  }
  return {
    sessionId,
    sessionName: session.sessionName?.trim() || "Trip",
  };
}

/** Seed fixture and open the trip page; waits for checklist chrome. */
export async function openSeededSession(
  page: Page,
  request: APIRequestContext,
  baseURL: string,
  slug: string,
): Promise<{ sessionId: string; sessionName: string }> {
  const seeded = await seedSessionFixture(request, slug, baseURL);
  await page.goto(`/sessions/${seeded.sessionId}`);
  const root = page.getByTestId("session-checklist");
  await expect(root).toBeVisible({ timeout: 30_000 });
  // Shell mounts before rows hydrate — wait out the trip spinner.
  await expect(page.getByRole("status", { name: "Loading trip" })).toHaveCount(
    0,
    { timeout: 30_000 },
  );
  await expect(
    page.getByRole("checkbox", { name: /Stop \d+, mark done:/i }).first(),
  ).toBeVisible({ timeout: 30_000 });
  // Prior runs may still have left the finish dialog open before seed reset.
  const finishDialog = page.getByRole("dialog").filter({
    has: page.getByRole("button", { name: "Run again" }),
  });
  if ((await finishDialog.count()) > 0) {
    await finishDialog.getByRole("button", { name: "Continue", exact: true }).nth(1).click();
    await expect(finishDialog).toHaveCount(0);
  }
  return seeded;
}

export function requireLocalBaseUrl(baseURL: string | undefined): string {
  if (
    !baseURL ||
    (!baseURL.includes("localhost") && !baseURL.includes("127.0.0.1"))
  ) {
    throw new Error("Local baseURL required for seeded UI specs");
  }
  return baseURL;
}
