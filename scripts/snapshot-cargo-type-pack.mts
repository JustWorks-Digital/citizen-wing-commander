/**
 * Baseline snapshot: current by-cargo-type placement for a session.
 * Usage: npx tsx scripts/snapshot-cargo-type-pack.mts [sessionId]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  cargoGridTotalLength,
  cargoGridZoneWidth,
  getCargoGridSketchBySlug,
} from "../lib/ships/cargoGrids";
import { placementPlanLegend } from "../lib/ships/cargoGridPlacement";
import { cargoBay } from "../lib/ships/cargoBay";
import type { HaulingChecklistRow } from "../lib/missions/mockSession";
import type { PlacedCargoBox } from "../lib/ships/cargoGridPlacement";

const sessionId =
  process.argv[2] ?? "6ec5cb16-e4ae-4d8a-a92e-1252a71cdd3b";
const base = process.env.APP_ORIGIN ?? "http://localhost:3000";

const res = await fetch(
  `${base}/api/checklist?sessionId=${encodeURIComponent(sessionId)}`,
);
if (!res.ok) {
  throw new Error(`checklist ${res.status}`);
}
const session = (await res.json()) as {
  id: string;
  sessionName?: string;
  shipSlugs?: string[];
  rows: HaulingChecklistRow[];
};

const shipSlug = session.shipSlugs?.[0] ?? "constellation-mk-v-centaurus";
const sketch = getCargoGridSketchBySlug(shipSlug);
if (!sketch) throw new Error(`no sketch for ${shipSlug}`);

const activeRow =
  session.rows.find((row) => !row.isCompleted) ??
  session.rows[session.rows.length - 1];
if (!activeRow) throw new Error("no checklist rows");

const plan = cargoBay.packAtStop(activeRow.id, sketch, session.rows, {
  packMode: "by-cargo-type",
  missionPrioritized: false,
});

const boxes = plan.boxes.map((box: PlacedCargoBox) => ({
  id: box.id,
  size: box.size,
  commoditySlug: box.commoditySlug,
  commodityName: box.commodityName,
  origin: box.origin,
  footprint: box.footprint,
  cells: box.cells,
  action: box.action,
  deliveryLocationSlug: box.deliveryLocationSlug ?? null,
}));

const byCommodity = new Map<string, typeof boxes>();
for (const box of boxes) {
  const list = byCommodity.get(box.commoditySlug) ?? [];
  list.push(box);
  byCommodity.set(box.commoditySlug, list);
}

const stacksSummary = [...byCommodity.entries()].map(([slug, group]) => {
  const cells = group.flatMap((b: (typeof boxes)[number]) => b.cells);
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const zs = cells.map((c) => c.z);
  return {
    commoditySlug: slug,
    boxCount: group.length,
    totalScu: group.reduce(
      (sum: number, b: (typeof boxes)[number]) => sum + b.size,
      0,
    ),
    bbox: {
      xMin: Math.min(...xs),
      xMax: Math.max(...xs),
      yMin: Math.min(...ys),
      yMax: Math.max(...ys),
      zMin: Math.min(...zs),
      zMax: Math.max(...zs),
    },
    origins: group.map((b: (typeof boxes)[number]) => ({
      size: b.size,
      origin: b.origin,
      footprint: b.footprint,
    })),
  };
});

const outDir = join(
  process.cwd(),
  ".ai-progress",
  `pack-baseline-${sessionId.slice(0, 8)}`,
);
mkdirSync(outDir, { recursive: true });

const snapshot = {
  capturedAt: new Date().toISOString(),
  label: "by-cargo-type baseline (pre pack-DSL)",
  sessionId: session.id,
  sessionName: session.sessionName ?? null,
  shipSlug,
  activeRowId: activeRow.id,
  packMode: "by-cargo-type",
  missionPrioritized: false,
  sketch: {
    widthCells: sketch.widthCells,
    heightCells: sketch.heightCells,
    totalLengthCells: cargoGridTotalLength(sketch),
    zones: sketch.zones.map((z) => ({
      id: z.id,
      storageLocation: z.storageLocation,
      lengthCells: z.lengthCells,
      widthCells: cargoGridZoneWidth(sketch, z),
      heightCells: sketch.heightCells,
    })),
  },
  boxCount: boxes.length,
  unplacedCount: plan.unplaced.length,
  unplaced: plan.unplaced,
  legend: placementPlanLegend(plan),
  stacksSummary,
  boxes,
};

const outPath = join(outDir, "by-cargo-type.json");
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(
  join(outDir, "stacks-summary.json"),
  `${JSON.stringify(stacksSummary, null, 2)}\n`,
);

console.log(
  JSON.stringify(
    {
      outPath,
      boxCount: boxes.length,
      unplaced: plan.unplaced.length,
      commodities: stacksSummary.length,
      stacksSummary,
    },
    null,
    2,
  ),
);
