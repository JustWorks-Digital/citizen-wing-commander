import { describe, expect, it } from "vitest";
import { formatTimeAgo } from "@/lib/ui/formatTimeAgo";

describe("formatTimeAgo", () => {
  const now = Date.parse("2026-11-14T20:00:00.000Z");

  it("formats seconds under one minute", () => {
    expect(formatTimeAgo("2026-11-14T19:59:45.000Z", now)).toBe("15s ago");
    expect(formatTimeAgo("2026-11-14T19:59:59.000Z", now)).toBe("1s ago");
  });

  it("formats minutes and hours", () => {
    expect(formatTimeAgo("2026-11-14T19:48:00.000Z", now)).toBe("12m ago");
    expect(formatTimeAgo("2026-11-14T17:00:00.000Z", now)).toBe("3h ago");
  });

  it("formats days from 24 hours up", () => {
    expect(formatTimeAgo("2026-11-13T20:00:00.000Z", now)).toBe("1d ago");
    expect(formatTimeAgo("2026-11-12T20:00:00.000Z", now)).toBe("2d ago");
    expect(formatTimeAgo("2026-11-07T20:00:00.000Z", now)).toBe("7d ago");
  });
});
