import { expect, test } from "../test";
import {
  MICROTECH_LOCAL_HAULS_SLUG,
  openSeededSession,
  requireLocalBaseUrl,
} from "../seedSessionFixture";

test.describe("cargo / open and dismiss bays", () => {
  test("opens cargo bays and dismisses the modal", async ({
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
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(
      page.getByRole("button", { name: "Dismiss" }),
    ).toHaveCount(0);
  });
});
