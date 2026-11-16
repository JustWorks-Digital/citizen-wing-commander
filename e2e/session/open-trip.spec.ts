import { expect, test } from "../test";
import {
  MICROTECH_LOCAL_HAULS_SLUG,
  openSeededSession,
  requireLocalBaseUrl,
} from "../seedSessionFixture";

test.describe("session / open trip", () => {
  test("opens seeded trip with checklist chrome", async ({
    page,
    request,
    baseURL,
  }) => {
    test.skip(
      !baseURL?.includes("localhost") && !baseURL?.includes("127.0.0.1"),
      "Local seed only",
    );
    const local = requireLocalBaseUrl(baseURL);
    const { sessionId, sessionName } = await openSeededSession(
      page,
      request,
      local,
      MICROTECH_LOCAL_HAULS_SLUG,
    );
    const root = page.getByTestId("session-checklist");
    await expect(root).toHaveAttribute("data-session-id", sessionId);
    await expect(
      page.getByText(sessionName, { exact: false }).first(),
    ).toBeVisible();
  });
});
