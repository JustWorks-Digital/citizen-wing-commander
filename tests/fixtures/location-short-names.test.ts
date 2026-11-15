import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeLocationShortNames,
  withLocationShortNames,
} from "@/lib/fixtures/locationShortNames.mjs";

type Loc = { slug: string; name: string; shortName?: string };

function loadLocations(): Loc[] {
  const file = path.join(process.cwd(), "lib/fixtures/locations.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as { items: Loc[] };
  return raw.items;
}

describe("location short names", () => {
  it("only uses exact substrings of the full name", () => {
    const items = withLocationShortNames(loadLocations());
    for (const row of items) {
      expect(row.name.includes(row.shortName), row.slug).toBe(true);
    }
  });

  it("keeps short names unique except shared Station-free spans for duplicate names", () => {
    const map = computeLocationShortNames(loadLocations());
    const byShort = new Map<string, { shortName: string; slugs: string[] }>();
    for (const [slug, shortName] of map) {
      const key = shortName.toLowerCase();
      const entry = byShort.get(key) ?? { shortName, slugs: [] };
      entry.slugs.push(slug);
      byShort.set(key, entry);
    }
    const items = loadLocations();
    const nameBySlug = new Map(items.map((row) => [row.slug, row.name]));
    for (const { shortName, slugs } of byShort.values()) {
      if (slugs.length <= 1) continue;
      for (const slug of slugs) {
        expect(nameBySlug.get(slug)?.includes(shortName), slug).toBe(true);
      }
      expect(shortName).not.toMatch(/\bstation\b/i);
    }
  });

  it("gives lagrange stations the short word before clinics", () => {
    const map = computeLocationShortNames(loadLocations());
    expect(map.get("hur-l4-melodic-fields-station")).toBe("Melodic");
    expect(map.get("hur-l4-melodic-fields-clinic")).toBe("Melodic Fields");
    expect(map.get("port-tressler")).toBe("Tressler");
  });

  it("gives stations the short word and never keeps Station in short names", () => {
    const map = computeLocationShortNames(loadLocations());
    expect(map.get("seraphim-station")).toBe("Seraphim");
    expect(map.get("seraphim-clinic")).toBe("Seraphim Clinic");
    expect(map.get("ruin-station")).toBe("Ruin");
    expect(map.get("ruin-clinic")).toBe("Ruin Clinic");
    for (const [, shortName] of map) {
      expect(shortName).not.toMatch(/\bstation\b/i);
    }
  });
});



