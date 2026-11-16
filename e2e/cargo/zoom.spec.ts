import { expect, test } from "../test";
import {
  MICROTECH_LOCAL_HAULS_SLUG,
  openSeededSession,
  requireLocalBaseUrl,
} from "../seedSessionFixture";

test.describe("cargo / zoom", () => {
  test("zoom controls respond in the bays modal", async ({
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
    const bays = page.getByRole("dialog");
    // Delivery stacks + bay sketch both expose zoom — use the bay sketch pair
    // (last) so a stacks footer does not intercept the click.
    const zoomOut = bays.getByRole("button", { name: "Zoom out" }).last();
    const zoomIn = bays.getByRole("button", { name: "Zoom in" }).last();
    await expect(zoomOut).toBeVisible({ timeout: 10_000 });
    await zoomOut.click();
    await zoomIn.click();
  });
});
