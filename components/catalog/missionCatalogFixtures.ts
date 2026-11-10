import type { CatalogMission } from "@/db/schema";
import {
  buildHaulingCatalogMissionPayload,
  type HaulingCatalogMissionPayload,
} from "@/lib/missions/catalogMission";
import { catalogRouteFlagsFromLocationSplits } from "@/lib/missions/catalogRouteFlags";

function haulingPayload(
  partial: Parameters<typeof buildHaulingCatalogMissionPayload>[0],
): HaulingCatalogMissionPayload {
  return buildHaulingCatalogMissionPayload(partial);
}

function withRouteFlags(
  row: Omit<
    CatalogMission,
    "isDirect" | "isOnePickup" | "isOneDelivery" | "variantGroupId" | "variantFamilyKey"
  > &
    Partial<Pick<CatalogMission, "variantGroupId" | "variantFamilyKey">>,
): CatalogMission {
  const flags = catalogRouteFlagsFromLocationSplits(
    row.scuLocationSplits ?? row.payload.scuLocationSplits,
    {
      fromSlugs: row.payload.fromLocationSlugs,
      toSlugs: row.payload.toLocationSlugs,
    },
  );
  return {
    ...row,
    ...flags,
    variantGroupId: row.variantGroupId ?? row.id,
    variantFamilyKey: row.variantFamilyKey ?? row.fingerprint,
  };
}

const now = new Date("2026-11-08T18:00:00.000Z");

/** Sample catalog rows for Storybook. */
export const sampleCatalogMissions: CatalogMission[] = [
  withRouteFlags({
    id: "11111111-1111-4111-8111-111111111111",
    type: "hauling",
    fingerprint: "fp-corundum",
    title: "Direct Small Cargo Haul",
    rank: "Junior",
    contractorSlug: "covalex-independent-contractors",
    rewards: [{ kind: "auec", amount: 42000 }],
    offerLocationSlug: "area18",
    offerStarSystemSlug: "stanton",
    scuTotal: 10,
    scuMaxContainerSize: 8,
    scuBoxSplits: { scuOne: 0, scuTwo: 1, scuFour: 0, scuEight: 1 },
    scuLocationSplits: {
      from: { "everus-harbor": 10 },
      to: { lorville: 10 },
    },
    payload: haulingPayload({
      title: "Junior Rank - Direct Small Cargo Haul",
      rank: "Junior",
      contractorSlug: "covalex-independent-contractors",
      rewards: [{ kind: "auec", amount: 42000 }],
      offerLocationSlug: "area18",
      offerStarSystemSlug: "stanton",
      fromLocationSlugs: ["everus-harbor"],
      toLocationSlugs: ["lorville"],
      cargo: [
        {
          commoditySlug: "corundum",
          commodityName: "Corundum",
          scu: 10,
        },
      ],
      scuTotal: 10,
      scuMaxContainerSize: 8,
      scuBoxSplits: { scuOne: 0, scuTwo: 1, scuFour: 0, scuEight: 1 },
      scuLocationSplits: {
        from: { "everus-harbor": 10 },
        to: { lorville: 10 },
      },
      latestScreenshotPath: "demo/contract-1_corundum_10scu.jpg",
    }),
    latestScreenshotPath: "demo/contract-1_corundum_10scu.jpg",
    missionRunCount: 2,
    missionTotalDurationMs: 2_400_000,
    missionAvgDurationMs: 1_200_000,
    lastObservedAt: now,
    createdAt: now,
    updatedAt: now,
  }),
  withRouteFlags({
    id: "22222222-2222-4222-8222-222222222222",
    type: "hauling",
    fingerprint: "fp-stims",
    title: "Small Cargo Haul",
    rank: "Member",
    contractorSlug: "red-wind",
    rewards: [{ kind: "auec", amount: 18500 }],
    offerLocationSlug: "lorville",
    offerStarSystemSlug: "stanton",
    scuTotal: 32,
    scuMaxContainerSize: 4,
    scuBoxSplits: { scuOne: 0, scuTwo: 0, scuFour: 8, scuEight: 0 },
    scuLocationSplits: {
      from: { lorville: 32 },
      to: { area18: 16, "port-tressler": 16 },
    },
    payload: haulingPayload({
      title: "Member Rank - Small Cargo Haul",
      rank: "Member",
      contractorSlug: "red-wind",
      rewards: [{ kind: "auec", amount: 18500 }],
      offerLocationSlug: "lorville",
      offerStarSystemSlug: "stanton",
      fromLocationSlugs: ["lorville"],
      toLocationSlugs: ["area18", "port-tressler"],
      cargo: [
        {
          commoditySlug: "medical-supplies",
          commodityName: "Medical Supplies",
          scu: 32,
        },
      ],
      scuTotal: 32,
      scuMaxContainerSize: 4,
      scuBoxSplits: { scuOne: 0, scuTwo: 0, scuFour: 8, scuEight: 0 },
      scuLocationSplits: {
        from: { lorville: 32 },
        to: { area18: 16, "port-tressler": 16 },
      },
      latestScreenshotPath: null,
    }),
    latestScreenshotPath: null,
    missionRunCount: 0,
    missionTotalDurationMs: 0,
    missionAvgDurationMs: null,
    lastObservedAt: now,
    createdAt: now,
    updatedAt: now,
  }),
  withRouteFlags({
    id: "33333333-3333-4333-8333-333333333333",
    type: "hauling",
    fingerprint: "fp-quartz",
    title: "Extra Small Cargo Haul",
    rank: "Rookie",
    contractorSlug: "hd-mining",
    rewards: [{ kind: "auec", amount: 61000 }],
    offerLocationSlug: "everus-harbor",
    offerStarSystemSlug: "stanton",
    scuTotal: 48,
    scuMaxContainerSize: 8,
    scuBoxSplits: { scuOne: 0, scuTwo: 0, scuFour: 0, scuEight: 6 },
    scuLocationSplits: {
      from: { magda: 24, "yela-asteroid-belt": 24 },
      to: { "everus-harbor": 48 },
    },
    payload: haulingPayload({
      title: "Rookie Rank - Extra Small Cargo Haul",
      rank: "Rookie",
      contractorSlug: "hd-mining",
      rewards: [{ kind: "auec", amount: 61000 }],
      offerLocationSlug: "everus-harbor",
      offerStarSystemSlug: "stanton",
      fromLocationSlugs: ["magda", "yela-asteroid-belt"],
      toLocationSlugs: ["everus-harbor"],
      cargo: [
        {
          commoditySlug: "quartz",
          commodityName: "Quartz",
          scu: 48,
        },
      ],
      scuTotal: 48,
      scuMaxContainerSize: 8,
      scuBoxSplits: { scuOne: 0, scuTwo: 0, scuFour: 0, scuEight: 6 },
      scuLocationSplits: {
        from: { magda: 24, "yela-asteroid-belt": 24 },
        to: { "everus-harbor": 48 },
      },
      latestScreenshotPath: "demo/quartz.png",
    }),
    latestScreenshotPath: "demo/quartz.png",
    missionRunCount: 1,
    missionTotalDurationMs: 900_000,
    missionAvgDurationMs: 900_000,
    lastObservedAt: now,
    createdAt: now,
    updatedAt: now,
  }),
];
