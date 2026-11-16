import { expect, test } from "../test";
import {
  MICROTECH_LOCAL_HAULS_SLUG,
  openSeededSession,
  requireLocalBaseUrl,
} from "../seedSessionFixture";

test.describe("mission checklist / mark stops done", () => {
  test("can mark later stops done by checkbox", async ({
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

    const stop5 = page.getByRole("checkbox", {
      name: /Stop 5, mark done: Shubin Mining Facility SM0-18/i,
    });
    const stop6 = page.getByRole("checkbox", {
      name: /Stop 6, mark done: Covalex Distribution Centre S4DC05/i,
    });
    await expect(stop5).toBeVisible({ timeout: 15_000 });
    await stop5.check();
    await expect(stop5).toBeChecked();
    await stop6.check();
    await expect(stop6).toBeChecked();
  });
});
