import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CARGO_BAY_CHROME_PREFS,
  readCargoBayChromePrefs,
  writeCargoBayChromePrefs,
} from "@/lib/sessions/cargoBayLayoutClientPrefs";

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

describe("DEFAULT_CARGO_BAY_CHROME_PREFS", () => {
  it("starts with Overlay off so Packing/Legend do not cover the bay", () => {
    expect(DEFAULT_CARGO_BAY_CHROME_PREFS.sidePanelsOverlay).toBe(false);
  });
});

describe("cargo bay chrome zoom persistence", () => {
  const sessionId = "zoom-reset-test-session";
  const key = `cwc:session:${sessionId}:cargoBayChrome`;

  beforeEach(() => {
    installMemoryLocalStorage();
  });

  afterEach(() => {
    // @ts-expect-error test cleanup
    delete globalThis.window;
    // @ts-expect-error test cleanup
    delete globalThis.localStorage;
  });

  it("does not restore top/iso zoom after write (modal reopen resets)", () => {
    writeCargoBayChromePrefs(sessionId, {
      ...DEFAULT_CARGO_BAY_CHROME_PREFS,
      topZoom: 2.1,
      isoZoom: 1.8,
      viewTab: "iso",
    });
    const stored = JSON.parse(window.localStorage.getItem(key)!) as {
      topZoom: number;
      isoZoom: number;
      viewTab: string;
    };
    expect(stored.topZoom).toBe(1);
    expect(stored.isoZoom).toBe(1);
    expect(stored.viewTab).toBe("iso");

    const read = readCargoBayChromePrefs(sessionId);
    expect(read.topZoom).toBe(1);
    expect(read.isoZoom).toBe(1);
    expect(read.viewTab).toBe("iso");
  });
});
