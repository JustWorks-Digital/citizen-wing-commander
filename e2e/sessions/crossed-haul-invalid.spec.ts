import { expect, test } from "../test";
import { seedSessionFixture } from "./seedSessionFixture";

const SLUG = "crossed-haul-invalid-2026-11-13";

test.describe("crossed-haul-invalid session smoke", () => {
  test("loads seeded trip checklist chrome", async ({ page, request, baseURL }) => {
    test.skip(
      !baseURL ||
        (!baseURL.includes("localhost") && !baseURL.includes("127.0.0.1")),
      "Local seed smoke only — set PLAYWRIGHT_BASE_URL for read-only prod separately",
    );

    const { sessionId, sessionName } = await seedSessionFixture(
      request,
      SLUG,
      baseURL!,
    );

    await page.goto(`/sessions/${sessionId}`);
    const root = page.getByTestId("session-checklist");
    await expect(root).toBeVisible({ timeout: 30_000 });
    await expect(root).toHaveAttribute("data-session-id", sessionId);
    await expect(page.getByText(sessionName, { exact: false }).first()).toBeVisible();
  });
});
