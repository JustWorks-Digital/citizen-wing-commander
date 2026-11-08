import { createHash } from "node:crypto";
import {
  CARGO_BOX_SCU,
  type CargoBoxScu,
  decomposeScuIntoBoxes,
} from "@/lib/ships/cargoBoxSizes";

/** Counts of each crate size used for a mission’s cargo total. */
export type CargoBoxBreakdown = {
  size1: number;
  size2: number;
  size4: number;
  size8: number;
};

export type CatalogMissionCargoLine = {
  commoditySlug: string;
  commodityName: string;
  scu: number;
};

/**
 * Durable catalog body for an observed hauling contract.
 * Stored in `catalog_missions.payload`.
 */
export type HaulingCatalogMissionPayload = {
  kind: "hauling";
  version: 1;
  title: string;
  contractor?: string | null;
  rewardAuec?: number | null;
  /** Where the offer was seen / screenshot taken (availability context). */
  offerLocationSlug?: string | null;
  fromLocationSlugs: string[];
  toLocationSlugs: string[];
  cargo: CatalogMissionCargoLine[];
  totalScu: number;
  maxContainerScu?: number | null;
  boxBreakdown: CargoBoxBreakdown;
  /** Logical screenshot path under `.data/mcp-screenshots`. */
  latestScreenshotPath?: string | null;
  /** Free-form extras from intake / OCR. */
  extras?: Record<string, unknown>;
};

export type CatalogMissionNoteSentiment = "good" | "bad" | "neutral";

export function emptyBoxBreakdown(): CargoBoxBreakdown {
  return { size1: 0, size2: 0, size4: 0, size8: 0 };
}

/**
 * Greedy 8→4→2→1 counts. When `maxContainerScu` is set, never emit a box larger
 * than that size (validated against allowed crate sizes).
 */
export function boxBreakdownForScu(
  scu: number,
  maxContainerScu?: number | null,
): CargoBoxBreakdown {
  const maxAllowed =
    typeof maxContainerScu === "number" && maxContainerScu > 0
      ? Math.max(
          ...CARGO_BOX_SCU.filter((size) => size <= maxContainerScu),
          1,
        )
      : null;

  const boxes =
    maxAllowed == null
      ? decomposeScuIntoBoxes(scu)
      : decomposeScuIntoBoxesCapped(scu, maxAllowed as CargoBoxScu);

  const counts = emptyBoxBreakdown();
  for (const size of boxes) {
    if (size === 1) counts.size1 += 1;
    else if (size === 2) counts.size2 += 1;
    else if (size === 4) counts.size4 += 1;
    else if (size === 8) counts.size8 += 1;
  }
  return counts;
}

function decomposeScuIntoBoxesCapped(
  scu: number,
  maxSize: CargoBoxScu,
): CargoBoxScu[] {
  const boxes: CargoBoxScu[] = [];
  let remaining = Math.max(0, Math.floor(scu));
  for (const size of CARGO_BOX_SCU) {
    if (size > maxSize) continue;
    while (remaining >= size) {
      boxes.push(size);
      remaining -= size;
    }
  }
  return boxes;
}

export function sumCatalogCargoScu(cargo: CatalogMissionCargoLine[]): number {
  return cargo.reduce((sum, line) => sum + Math.max(0, line.scu), 0);
}

/** Stable dedupe key for upserting the same observed contract. */
export function catalogMissionFingerprint(
  input: Pick<
    HaulingCatalogMissionPayload,
    | "title"
    | "contractor"
    | "offerLocationSlug"
    | "fromLocationSlugs"
    | "toLocationSlugs"
    | "cargo"
  >,
): string {
  const cargoKey = [...input.cargo]
    .map((line) => `${line.commoditySlug}:${line.scu}`)
    .sort()
    .join(",");
  const raw = [
    input.title.trim().toLowerCase(),
    (input.contractor ?? "").trim().toLowerCase(),
    (input.offerLocationSlug ?? "").trim().toLowerCase(),
    [...input.fromLocationSlugs].map((s) => s.toLowerCase()).sort().join("|"),
    [...input.toLocationSlugs].map((s) => s.toLowerCase()).sort().join("|"),
    cargoKey,
  ].join("::");
  return createHash("sha256").update(raw).digest("hex");
}

export function buildHaulingCatalogMissionPayload(
  partial: Omit<
    HaulingCatalogMissionPayload,
    "kind" | "version" | "totalScu" | "boxBreakdown"
  > & {
    totalScu?: number;
    boxBreakdown?: CargoBoxBreakdown;
  },
): HaulingCatalogMissionPayload {
  const totalScu = partial.totalScu ?? sumCatalogCargoScu(partial.cargo);
  return {
    kind: "hauling",
    version: 1,
    title: partial.title,
    contractor: partial.contractor ?? null,
    rewardAuec: partial.rewardAuec ?? null,
    offerLocationSlug: partial.offerLocationSlug ?? null,
    fromLocationSlugs: partial.fromLocationSlugs,
    toLocationSlugs: partial.toLocationSlugs,
    cargo: partial.cargo,
    totalScu,
    maxContainerScu: partial.maxContainerScu ?? null,
    boxBreakdown:
      partial.boxBreakdown ??
      boxBreakdownForScu(totalScu, partial.maxContainerScu),
    latestScreenshotPath: partial.latestScreenshotPath ?? null,
    extras: partial.extras,
  };
}
