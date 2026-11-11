import {
  expandPackProgram,
  type CargoBayPackProgram,
  type PackCall,
} from "@/lib/ships/cargoBayPackProgram";
import type { CargoPlacementItem } from "@/lib/ships/cargoGridPlacement";

function itemClusterKey(item: CargoPlacementItem): string {
  return item.clusterKey ?? item.commoditySlug;
}

function groupKeyFor(
  item: CargoPlacementItem,
  by: "cargo-type" | "delivery-location",
): string {
  if (by === "delivery-location") {
    return item.regionKey ?? item.deliveryLocationSlug ?? itemClusterKey(item);
  }
  return item.commoditySlug;
}

function totalScu(items: CargoPlacementItem[]): number {
  return items.reduce((sum, item) => sum + item.size, 0);
}

/**
 * Reorder placement items according to group/order pack primitives.
 * Stack/require/bias-xy do not affect this phase.
 */
export function orderPackItemsByProgram(
  items: CargoPlacementItem[],
  program: CargoBayPackProgram,
): CargoPlacementItem[] {
  const calls = expandPackProgram(program).filter(
    (call) =>
      call.call === "group" ||
      (call.call === "order" &&
        (call.target === "groups" || call.target === "boxes-within-group")),
  );

  if (calls.length === 0) return [...items];

  const groupCall = calls.find(
    (call): call is Extract<PackCall, { call: "group" }> =>
      call.call === "group",
  );
  // Prefer cargo-type group when both appear (contract-based lists delivery then cargo).
  const cargoTypeGroup = [...calls]
    .reverse()
    .find(
      (call): call is Extract<PackCall, { call: "group" }> =>
        call.call === "group" && call.by === "cargo-type",
    );
  const activeGroup = cargoTypeGroup ?? groupCall;
  const groupBy = activeGroup?.by ?? "cargo-type";

  const byKey = new Map<string, CargoPlacementItem[]>();
  const keyOrder: string[] = [];
  for (const item of items) {
    const key = groupKeyFor(item, groupBy);
    const list = byKey.get(key);
    if (list) {
      list.push(item);
      continue;
    }
    byKey.set(key, [item]);
    keyOrder.push(key);
  }

  const orderGroups = calls.find(
    (call) =>
      call.call === "order" &&
      call.target === "groups" &&
      call.by === "total-scu",
  );
  if (orderGroups && orderGroups.call === "order") {
    keyOrder.sort((a, b) => {
      const scuA = totalScu(byKey.get(a)!);
      const scuB = totalScu(byKey.get(b)!);
      if (scuA === scuB) return a.localeCompare(b);
      return orderGroups.direction === "descending" ? scuB - scuA : scuA - scuB;
    });
  }

  const orderBoxes = calls.filter(
    (call) => call.call === "order" && call.target === "boxes-within-group",
  );

  const out: CargoPlacementItem[] = [];
  for (const key of keyOrder) {
    const group = [...byKey.get(key)!];
    group.sort((a, b) => {
      for (const call of orderBoxes) {
        if (call.call !== "order") continue;
        if (call.by === "box-scu") {
          if (a.size !== b.size) {
            return call.direction === "descending"
              ? b.size - a.size
              : a.size - b.size;
          }
          continue;
        }
        if (call.by === "delivery-rank") {
          const rankA = a.missionRank ?? Number.POSITIVE_INFINITY;
          const rankB = b.missionRank ?? Number.POSITIVE_INFINITY;
          if (rankA !== rankB) {
            // descending = later deliveries first (early unload ends on top).
            return call.direction === "descending"
              ? rankB - rankA
              : rankA - rankB;
          }
          continue;
        }
        if (call.by === "route-order") {
          // Items already roughly route-ordered; keep stable.
          continue;
        }
      }
      return 0;
    });
    out.push(...group);
  }
  return out;
}
