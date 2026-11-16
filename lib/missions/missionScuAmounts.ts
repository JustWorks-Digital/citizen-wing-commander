import { missionLocationScu } from "@/lib/missions/missionLocationScu";
import { missionScuDraft } from "@/lib/missions/missionScuDraft";
import { missionScuMutate } from "@/lib/missions/missionScuMutate";

export type { MissionLocationScuLine } from "@/lib/missions/missionLocationScu";
export type {
  MissionScuDraft,
  MissionScuDraftCommodity,
  MissionScuDraftDelivery,
} from "@/lib/missions/missionScuDraft";
export { rebalanceDraftDeliveries } from "@/lib/missions/missionScuDraft";

/**
 * Editable SCU for the box-types modal: mission cargo totals and
 * per-location collect/deliver amounts.
 *
 * Facade over draft / location-read / mutate modules — keep importing from here.
 */
export const missionScuAmounts = {
  draftFromMission: missionScuDraft.draftFromMission,
  setDeliveryScuInDraft: missionScuDraft.setDeliveryScuInDraft,
  setCommodityScuInDraft: missionScuDraft.setCommodityScuInDraft,
  validateDraft: missionScuDraft.validateDraft,
  locationLines: missionLocationScu.locationLines,
  applyDraft: missionScuMutate.applyDraft,
  setCommodityTotal: missionScuMutate.setCommodityTotal,
  setLocationAmount: missionScuMutate.setLocationAmount,
};
