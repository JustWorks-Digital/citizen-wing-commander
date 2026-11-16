import { expect, test } from "../test";
import {
  MICROTECH_LOCAL_HAULS_SLUG,
  openSeededSession,
  requireLocalBaseUrl,
} from "../seedSessionFixture";

test.describe("mission checklist / completion summary", () => {
  test("shows Continue after every stop is done", async ({
    page,
    request,
    baseURL,
  }) => {
    test.skip(
      !baseURL?.includes("localhost") && !baseURL?.includes("127.0.0.1"),
      "Local seed only",
    );
    await openSeededSession(
      page,
      request,
      requireLocalBaseUrl(baseURL),
      MICROTECH_LOCAL_HAULS_SLUG,
    );

    // Prefer live “first unchecked” so completed stops leaving the active list
    // do not shift nth() indexes mid-loop.
    for (;;) {
      const next = page
        .getByRole("checkbox", { name: /Stop \d+, mark done:/i })
        .locator("visible=true")
        .and(page.locator('[aria-checked="false"]'))
        .first();
      if ((await next.count()) === 0) break;
      const label = await next.getAttribute("aria-label");
      await next.click();
      if (label) {
        await expect(
          page.getByRole("checkbox", { name: label, exact: true }).first(),
        ).toBeChecked({ timeout: 10_000 });
      }
    }

    await expect(page.getByRole("button", { name: /Stop \d+\/\d+/ })).toContainText(
      /(\d+)\/\1/,
      { timeout: 10_000 },
    );

    const summary = page.getByRole("dialog");
    await expect(summary).toBeVisible({ timeout: 15_000 });
    // Header close + footer share the Continue name — assert the footer CTA.
    await expect(
      summary.getByRole("button", { name: "Continue", exact: true }).nth(1),
    ).toBeVisible();
  });
});
