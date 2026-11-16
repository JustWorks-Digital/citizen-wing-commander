import type { SessionChecklist } from "@/lib/missions/sessionChecklist";

/**
 * Static demo session so the table UI can ship before API wiring.
 * Location/cargo slugs must exist in fixtures (`npm run fixtures:fetch`).
 */
export const mockSessionChecklist: SessionChecklist = {
  id: "11111111-1111-4111-8111-111111111111",
  sessionName: "Stanton hauling run",
  shipSlugs: ["c2-hercules-starlifter", "misc-freelancer-max"],
  startLocationSlug: "area18",
  missionCount: 1,
  missionsCompleted: 0,
  missions: [
    {
      id: "demo-area18-haul",
      title: "Direct Medium Cargo Haul",
      rank: "Junior",
      contractor: "Covalex Independent Contractors",
      rewardAuec: 80000,
      rewardDisplay: "80,000 aUEC",
      from: ["Area18"],
      to: ["Baijini Point"],
      cargo: [
        { commodity: "Pressurized Ice", scu: 8 },
        { commodity: "Processed Food", scu: 9 },
      ],
      cargoSummary: "8 SCU Pressurized Ice · 9 SCU Processed Food",
      isCompleted: false,
      screenshots: ["demo-batch/area18-baijini-contract.png"],
      mobiglas: {
        tab: "Accepted",
        acceptedCount: "1/10",
        category: "Hauling - Planetary",
        title: "Direct Medium Cargo Haul",
        contractor: "Covalex Independent Contractors",
        rewardAuec: 80000,
        rewardDisplay: "80,000 aUEC",
        timeRemaining: null,
        deadline: null,
        details:
          "Demo contract for Storybook / local preview. Haul mixed cargo from Area18 toward Baijini Point.",
        contact: "Chase Hewitt, Jr. Logistics Coordinator, Covalex Shipping",
        objectives: [
          {
            label: "Deliver cargo toward Baijini Point",
            progressCurrent: 0,
            progressTotal: 17,
            children: ["Collect from Area18"],
          },
        ],
      },
    },
  ],
  startedAt: new Date().toISOString(),
  completedAt: null,
  updatedAt: new Date().toISOString(),
  rows: [
    {
      id: "leg-1",
      routeAction: "pickup",
      locationSlug: "area18",
      cargoDeliveries: [
        {
          commoditySlug: "pressurized-ice",
          scu: 8,
          shipStorageLocation: "front",
          missionId: "demo-area18-haul",
          boxSizes: [8],
        },
        {
          commoditySlug: "processed-food",
          scu: 9,
          shipStorageLocation: "front",
          missionId: "demo-area18-haul",
          boxSizes: [8, 1],
        },
      ],
      shipStorageLocation: "front",
      distanceToNext: { value: 12.4, unit: "Mm" },
      isCompleted: true,
    },
    {
      id: "leg-2",
      routeAction: "delivery",
      locationSlug: "baijini-point",
      cargoDeliveries: [
        {
          commoditySlug: "medical-supplies",
          scu: 32,
          shipStorageLocation: "middle",
          missionId: "demo-area18-haul",
          boxSizes: [16, 16],
        },
      ],
      shipStorageLocation: "middle",
      distanceToNext: { value: 27, unit: "Gm" },
      isCompleted: false,
    },
    {
      id: "leg-3",
      routeAction: "both",
      locationSlug: "orison",
      cargoDeliveries: [
        {
          commoditySlug: "scrap",
          scu: 24,
          role: "delivery",
          shipStorageLocation: "front",
          missionId: "demo-area18-haul",
          boxSizes: [8, 8, 8],
        },
        {
          commoditySlug: "agricium",
          scu: 40,
          role: "pickup",
          shipStorageLocation: "rear",
          missionId: "demo-area18-haul",
          boxSizes: [32, 8],
        },
      ],
      shipStorageLocation: "rear",
      distanceToNext: { value: 450.5, unit: "km" },
      isCompleted: false,
    },
    {
      id: "leg-4",
      routeAction: "delivery",
      locationSlug: "port-tressler",
      cargoDeliveries: [],
      shipStorageLocation: "rear",
      distanceToNext: null,
      isCompleted: false,
    },
  ],
};
