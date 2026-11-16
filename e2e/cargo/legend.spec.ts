import { expect, test } from "../test";
import {
  MICROTECH_LOCAL_HAULS_SLUG,
  openSeededSession,
  requireLocalBaseUrl,
} from "../seedSessionFixture";

test.describe("cargo / legend", () => {
  test("toggles bay legend", async ({ page, request, baseURL }) => {
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
      page.getByRole("button", { name: "Show legend" }),
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Show legend" }).click();
    await expect(
      page.getByRole("button", { name: "Hide legend" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Hide legend" }).click();
    await expect(
      page.getByRole("button", { name: "Show legend" }),
    ).toBeVisible();
  });
});
