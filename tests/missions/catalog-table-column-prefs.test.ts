import { describe, expect, it } from "vitest";
import {
  CATALOG_TABLE_COLUMN_KEYS,
  normalizeCatalogTableVisibleColumns,
  toggleCatalogTableColumn,
} from "@/lib/missions/catalogTableColumnPrefs";

describe("catalogTableColumnPrefs", () => {
  it("normalizes unknown entries and preserves catalog order", () => {
    expect(
      normalizeCatalogTableVisibleColumns(["cargo", "title", "nope", "cargo"]),
    ).toEqual(["title", "cargo"]);
  });

  it("falls back to all columns when empty", () => {
    expect(normalizeCatalogTableVisibleColumns([])).toEqual([
      ...CATALOG_TABLE_COLUMN_KEYS,
    ]);
  });

  it("toggles columns on and off", () => {
    const withoutTitle = toggleCatalogTableColumn(
      [...CATALOG_TABLE_COLUMN_KEYS],
      "title",
    );
    expect(withoutTitle).not.toContain("title");
    expect(withoutTitle).toContain("from");

    const restored = toggleCatalogTableColumn(withoutTitle, "title");
    expect(restored).toContain("title");
  });

  it("keeps at least one column visible", () => {
    expect(toggleCatalogTableColumn(["from"], "from")).toEqual(["from"]);
  });
});
