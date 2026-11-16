import { expect, test } from "../test";
import { openSeededSession, requireLocalBaseUrl } from "../seedSessionFixture";

const SLUG = "crossed-haul-invalid-2026-11-13";

test.describe("session / crossed-haul open trip", () => {
  test("opens crossed-haul fixture checklist chrome", async ({
    page,
    request,
    baseURL,
  }) => {
    test.skip(
      !baseURL?.includes("localhost") && !baseURL?.includes("127.0.0.1"),
      "Local seed only",
    );
    const { sessionId, sessionName } = await openSeededSession(
      page,
      request,
      requireLocalBaseUrl(baseURL),
      SLUG,
    );
    const root = page.getByTestId("session-checklist");
    await expect(root).toHaveAttribute("data-session-id", sessionId);
    await expect(
      page.getByText(sessionName, { exact: false }).first(),
    ).toBeVisible();
  });
});
