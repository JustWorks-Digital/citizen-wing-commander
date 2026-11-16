import { expect, test as base } from "@playwright/test";
import { resolveFailOnConsole } from "./failOnConsole";

const failOnConsole = resolveFailOnConsole();

/**
 * Playwright test that can fail when the page logs `console.error` or throws
 * an uncaught exception (`pageerror`).
 *
 * Config: `PLAYWRIGHT_FAIL_ON_CONSOLE` in `.env` / `.env.local`, or
 * `npm run test:e2e -- --fail-on-console` / `--no-fail-on-console`.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const errors: string[] = [];

    if (failOnConsole) {
      page.on("pageerror", (error) => {
        errors.push(`pageerror: ${error.message}`);
      });

      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (text.includes("Download the React DevTools")) return;
        errors.push(`console.error: ${text}`);
      });
    }

    await use(page);

    if (!failOnConsole) return;

    expect
      .soft(
        errors,
        [
          `Browser reported ${errors.length} error(s) during ${testInfo.title}:`,
          ...errors.map((line) => `  - ${line}`),
        ].join("\n"),
      )
      .toEqual([]);
  },
});

export { expect };
