import { expect, test } from "../test";
import {
  MICROTECH_LOCAL_HAULS_SLUG,
  openSeededSession,
  requireLocalBaseUrl,
} from "../seedSessionFixture";

test.describe("cargo / packing", () => {
  test("toggles split view and show/hide packing", async ({
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

    await page.getByRole("button", { name: "Open bays" }).click();
    await expect(
      page.getByRole("button", { name: "Dismiss" }),
    ).toBeVisible({ timeout: 10_000 });

    const split = page.getByRole("tab", { name: /Split/i });
    if (await split.count()) {
      await split.first().click();
    }

    await page.getByRole("button", { name: "Show packing" }).click();
    await expect(
      page.getByRole("button", { name: "Hide packing" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Hide packing" }).click();
    await expect(
      page.getByRole("button", { name: "Show packing" }),
    ).toBeVisible();
  });
});
