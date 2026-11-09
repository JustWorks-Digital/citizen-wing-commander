import type { CatalogMission } from "@/db/schema";
import type { HaulingCatalogMissionPayload } from "@/lib/missions/catalogMission";

function haulingPayload(
  partial: Omit<HaulingCatalogMissionPayload, "kind" | "version"> &
    Partial<Pick<HaulingCatalogMissionPayload, "kind" | "version">>,
): HaulingCatalogMissionPayload {
  return {
    kind: "hauling",
    version: 1,
    ...partial,
  };
}

const now = new Date("2026-11-08T18:00:00.000Z");

/** Sample catalog rows for Storybook. */
export const sampleCatalogMissions: CatalogMission[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    type: "hauling",
    fingerprint: "fp-corundum",
    title: "Hauling — Corundum",
    contractor: "Covalex Shipping",
    rewardAuec: 42000,
    offerLocationSlug: "area18",
    totalScu: 10,
    maxContainerScu: 8,
    boxBreakdown: { size1: 0, size2: 1, size4: 0, size8: 1 },
    payload: haulingPayload({
      title: "Hauling — Corundum",
      contractor: "Covalex Shipping",
      rewardAuec: 42000,
      offerLocationSlug: "area18",
      fromLocationSlugs: ["everus-harbor"],
      toLocationSlugs: ["lorville"],
      cargo: [
        {
          commoditySlug: "corundum",
          commodityName: "Corundum",
          scu: 10,
        },
      ],
      totalScu: 10,
      maxContainerScu: 8,
      boxBreakdown: { size1: 0, size2: 1, size4: 0, size8: 1 },
      latestScreenshotPath: "demo/contract-1_corundum_10scu.jpg",
    }),
    latestScreenshotPath: "demo/contract-1_corundum_10scu.jpg",
    runCount: 2,
    totalDurationMs: 2_400_000,
    avgDurationMs: 1_200_000,
    lastObservedAt: now,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    type: "hauling",
    fingerprint: "fp-stims",
    title: "Hauling — Medical Supplies",
    contractor: "Red Wind",
    rewardAuec: 18500,
    offerLocationSlug: "lorville",
    totalScu: 32,
    maxContainerScu: 4,
    boxBreakdown: { size1: 0, size2: 0, size4: 8, size8: 0 },
    payload: haulingPayload({
      title: "Hauling — Medical Supplies",
      contractor: "Red Wind",
      rewardAuec: 18500,
      offerLocationSlug: "lorville",
      fromLocationSlugs: ["lorville"],
      toLocationSlugs: ["area18"],
      cargo: [
        {
          commoditySlug: "medical-supplies",
          commodityName: "Medical Supplies",
          scu: 32,
        },
      ],
      totalScu: 32,
      maxContainerScu: 4,
      boxBreakdown: { size1: 0, size2: 0, size4: 8, size8: 0 },
      latestScreenshotPath: null,
    }),
    latestScreenshotPath: null,
    runCount: 0,
    totalDurationMs: 0,
    avgDurationMs: null,
    lastObservedAt: now,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    type: "hauling",
    fingerprint: "fp-quartz",
    title: "Hauling — Quartz",
    contractor: "HD Mining",
    rewardAuec: 61000,
    offerLocationSlug: "everus-harbor",
    totalScu: 48,
    maxContainerScu: 8,
    boxBreakdown: { size1: 0, size2: 0, size4: 0, size8: 6 },
    payload: haulingPayload({
      title: "Hauling — Quartz",
      contractor: "HD Mining",
      rewardAuec: 61000,
      offerLocationSlug: "everus-harbor",
      fromLocationSlugs: ["magda"],
      toLocationSlugs: ["everus-harbor"],
      cargo: [
        {
          commoditySlug: "quartz",
          commodityName: "Quartz",
          scu: 48,
        },
      ],
      totalScu: 48,
      maxContainerScu: 8,
      boxBreakdown: { size1: 0, size2: 0, size4: 0, size8: 6 },
      latestScreenshotPath: "demo/quartz.png",
    }),
    latestScreenshotPath: "demo/quartz.png",
    runCount: 1,
    totalDurationMs: 900_000,
    avgDurationMs: 900_000,
    lastObservedAt: now,
    createdAt: now,
    updatedAt: now,
  },
];
