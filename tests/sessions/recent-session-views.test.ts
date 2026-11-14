import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  RECENT_SESSION_VIEWS_MAX,
  readRecentSessionIds,
  recordRecentSessionView,
  removeRecentSessionView,
} from "@/lib/sessions/recentSessionViews";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: { localStorage },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: localStorage,
  });
}

describe("recentSessionViews", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  afterEach(() => {
    // @ts-expect-error test cleanup
    delete globalThis.window;
    // @ts-expect-error test cleanup
    delete globalThis.localStorage;
  });

  it("records views most-recent first and caps the list", () => {
    for (let i = 1; i <= RECENT_SESSION_VIEWS_MAX + 2; i += 1) {
      recordRecentSessionView(`s${i}`);
    }
    expect(readRecentSessionIds()).toEqual([
      `s${RECENT_SESSION_VIEWS_MAX + 2}`,
      `s${RECENT_SESSION_VIEWS_MAX + 1}`,
      `s${RECENT_SESSION_VIEWS_MAX}`,
      `s${RECENT_SESSION_VIEWS_MAX - 1}`,
      `s${RECENT_SESSION_VIEWS_MAX - 2}`,
    ]);
  });

  it("moves a revisited session to the front", () => {
    recordRecentSessionView("a");
    recordRecentSessionView("b");
    recordRecentSessionView("a");
    expect(readRecentSessionIds()).toEqual(["a", "b"]);
  });

  it("removes a closed session", () => {
    recordRecentSessionView("a");
    recordRecentSessionView("b");
    expect(removeRecentSessionView("a")).toEqual(["b"]);
  });
});
