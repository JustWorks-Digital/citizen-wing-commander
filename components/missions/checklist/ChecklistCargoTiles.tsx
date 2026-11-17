"use client";

import { useEffect, useState, type ReactNode } from "react";
import { describeCargoDeliveries, getCommodityIconSrc } from "@/lib/fixtures";
import {
  commodityBadgeBackground,
  commodityBadgeBorder,
  commodityBadgeForeground,
  resolveCommodityColorHex,
} from "@/lib/fixtures/commodityColors";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import type { StopTransferLedger } from "@/lib/missions/cargoInventory";
import {
  estimateMissionHaulingRepXp,
  formatHaulingRepXp,
} from "@/lib/missions/haulingRepXp";
import { resolveMissionRank, resolveMissionTitle } from "@/lib/missions/missionRank";
import { commoditySlugOf } from "@/lib/missions/missionScuShared";
import { inferCargoMissionId, screenshotRefsForMission } from "@/lib/missions/rowMissionScreenshots";
import { missionRewardLabel } from "@/lib/missions/sessionMissionObjectives";
import type { SessionMission } from "@/lib/missions/sessionMissions";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { StopMissionScreenshots } from "../StopMissionScreenshots";
import { PlusIcon } from "./ChecklistIcons";
import { DeliveryTransferBlock, PickupTransferBlock } from "./TransferBlocks";

export type CargoLine = ReturnType<typeof describeCargoDeliveries>[number];

function groupCargoLines(lines: CargoLine[]): {
  role: "pickup" | "delivery" | null;
  items: CargoLine[];
}[] {
  /** Drop off before Pickup at both-stops (unload then load). */
  const order: ("pickup" | "delivery" | null)[] = ["delivery", "pickup", null];
  const groups: { role: "pickup" | "delivery" | null; items: CargoLine[] }[] =
    [];
  for (const role of order) {
    const items = lines.filter(
      (line) =>
        line.role === role &&
        line.scu != null &&
        line.scu > 0 &&
        line.commodityName,
    );
    if (items.length > 0) groups.push({ role, items });
  }
  if (groups.length === 0) {
    return [{ role: null, items: lines }];
  }
  return groups;
}

export function CargoTileHandledMark({
  isPickup,
}: {
  isPickup: boolean;
}) {
  const stroke = isPickup ? "var(--rsi-accent)" : "var(--rsi-gold)";
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <svg viewBox="0 0 20 20" className="size-5 drop-shadow-sm">
        <circle
          cx="10"
          cy="10"
          r="8.25"
          fill="var(--rsi-bg-deep)"
          stroke={stroke}
          strokeWidth="1.5"
        />
        <path
          d="M6.2 10.1 L8.7 12.5 L13.8 7.4"
          fill="none"
          stroke={stroke}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function cargoPendingKey(rowId: string, cargoIndex: number): string {
  return `${rowId}:${cargoIndex}`;
}

function partitionCargoByMission(
  items: CargoLine[],
  row: HaulingChecklistRow,
  missions: SessionMission[],
  groupRole: "pickup" | "delivery" | null,
): Array<{
  missionId: string | null;
  items: CargoLine[];
}> {
  const buckets = new Map<string | null, CargoLine[]>();
  const order: Array<string | null> = [];
  for (const line of items) {
    const key = line.commoditySlug
      ? (inferCargoMissionId({
          missionId: line.missionId,
          commoditySlug: line.commoditySlug,
          role: line.role ?? groupRole,
          row,
          missions,
          groupRole,
        }) ?? null)
      : null;
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(line);
  }
  return order.map((missionId) => ({
    missionId,
    items: buckets.get(missionId)!,
  }));
}

export function CargoCommodityTile({
  row,
  line,
  isPickup,
  handledVerb,
  doneClass,
  pendingCargoKeys,
  onToggleCargoHandled,
  missionId = null,
  onSkipPickup,
  canSkipPickup,
  pendingSkipPickupKeys,
}: {
  row: HaulingChecklistRow;
  line: CargoLine;
  isPickup: boolean;
  handledVerb: string;
  doneClass: string;
  pendingCargoKeys?: ReadonlySet<string>;
  onToggleCargoHandled?: (
    rowId: string,
    cargoIndex: number,
  ) => void | Promise<void>;
  missionId?: string | null;
  onSkipPickup?: (missionId: string, commoditySlug: string) => void;
  canSkipPickup?: (missionId: string, commoditySlug: string) => boolean;
  pendingSkipPickupKeys?: ReadonlySet<string>;
}) {
  const cleared = line.isHandled;
  const isCargoPending =
    line.sourceIndex != null &&
    Boolean(pendingCargoKeys?.has(cargoPendingKey(row.id, line.sourceIndex)));
  const canToggle =
    Boolean(onToggleCargoHandled) &&
    line.sourceIndex != null &&
    !isCargoPending;
  const commoditySlug = line.commoditySlug?.trim() || "";
  const canSkip =
    isPickup &&
    Boolean(onSkipPickup) &&
    Boolean(missionId) &&
    commoditySlug.length > 0 &&
    (line.scu ?? 0) > 0 &&
    !row.isCompleted &&
    (canSkipPickup?.(missionId!, commoditySlug) ?? false);
  const skipPendingKey =
    missionId && commoditySlug
      ? `${missionId}::${commoditySlug}::${row.locationSlug}`
      : null;
  const isSkipPending = Boolean(
    skipPendingKey && pendingSkipPickupKeys?.has(skipPendingKey),
  );
  const cargoHex = resolveCommodityColorHex(
    line.color,
    line.color2,
    line.commoditySlug,
  );
  const iconSrc = getCommodityIconSrc(line.commoditySlug);
  const commodityName =
    line.commodityName?.trim() || line.commoditySlug || "Cargo";
  const fullLabel = `${line.scu} ${commodityName}`;
  const tileBg = cargoHex
    ? commodityBadgeBackground(cargoHex)
    : "var(--rsi-bg-deep)";
  const tileBorder = cargoHex
    ? commodityBadgeBorder(cargoHex)
    : "var(--rsi-border)";
  const tileFg = cargoHex
    ? commodityBadgeForeground(cargoHex)
    : "var(--rsi-text-secondary)";
  const statusSuffix = isCargoPending
    ? "updating…"
    : cleared
      ? `marked ${handledVerb}`
      : `click to mark ${handledVerb}`;

  return (
    <div className="relative min-w-0">
      {canSkip && missionId ? (
        <button
          type="button"
          aria-label={`Skip pick up of ${commodityName} at this stop`}
          aria-busy={isSkipPending || undefined}
          disabled={isSkipPending}
          title="Skip pick up — remaining stops absorb this SCU"
          className={[
            "absolute top-0.5 right-0.5 z-10 inline-flex size-5 items-center justify-center rounded-sm border font-mono text-[0.7rem] leading-none shadow-sm transition-opacity",
            isSkipPending
              ? "cursor-wait opacity-70"
              : "hover:opacity-90",
          ].join(" ")}
          style={{
            backgroundColor: tileBg,
            borderColor: tileBorder,
            color: tileFg,
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (isSkipPending) return;
            onSkipPickup?.(missionId, commoditySlug);
          }}
        >
          {isSkipPending ? (
            <Spinner className="size-2.5" label="Skipping" />
          ) : (
            "×"
          )}
        </button>
      ) : null}
      <button
        type="button"
        title={[fullLabel, statusSuffix].join(" · ")}
        aria-label={fullLabel}
        aria-pressed={cleared}
        aria-busy={isCargoPending}
        disabled={!canToggle && !isCargoPending}
        onClick={(event) => {
          event.stopPropagation();
          if (line.sourceIndex == null || isCargoPending) return;
          void onToggleCargoHandled?.(row.id, line.sourceIndex);
        }}
        className={[
          // Mobile: corner icon. md+: centered stack; density follows cargo @container.
          "relative flex aspect-square w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded-rsi border px-1 py-1 font-mono font-medium tabular-nums",
          "md:gap-0.5 md:px-1 md:py-1",
          "md:@[13rem]/cargo:gap-0.5 md:@[13rem]/cargo:px-1 md:@[13rem]/cargo:py-1.5",
          "md:@[17rem]/cargo:gap-1 md:@[17rem]/cargo:px-1.5 md:@[17rem]/cargo:py-2",
          "transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
          isCargoPending
            ? "cursor-wait"
            : canToggle
              ? "cursor-pointer"
              : "cursor-default",
          doneClass,
          cleared && !isCargoPending ? "opacity-40" : "",
        ].join(" ")}
        style={{
          backgroundColor: tileBg,
          borderColor: tileBorder,
          color: tileFg,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 left-1 size-3 shrink-0 bg-current opacity-90 md:hidden"
          style={{
            WebkitMaskImage: `url(${iconSrc})`,
            maskImage: `url(${iconSrc})`,
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
        <span
          aria-hidden
          className="hidden size-2.5 shrink-0 bg-current md:inline-block md:@[17rem]/cargo:size-3"
          style={{
            WebkitMaskImage: `url(${iconSrc})`,
            maskImage: `url(${iconSrc})`,
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
        <span className="text-sm font-semibold leading-none md:text-[0.6rem] md:@[17rem]/cargo:text-[0.65rem]">
          {line.scu}
        </span>
        <span className="line-clamp-2 w-full min-w-0 text-center text-[0.55rem] leading-snug tracking-wide break-words opacity-90 normal-case md:text-[0.5rem] md:@[13rem]/cargo:text-[0.5rem] md:@[17rem]/cargo:text-[0.55rem]">
          {commodityName}
        </span>
        {isCargoPending ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-rsi bg-rsi-bg-deep/55"
          >
            <Spinner className="size-3.5 text-rsi-accent" />
          </span>
        ) : cleared ? (
          <CargoTileHandledMark isPickup={isPickup} />
        ) : null}
      </button>
    </div>
  );
}

export function CargoCommodityTiles({
  row,
  items,
  role,
  pendingCargoKeys,
  onToggleCargoHandled,
  missionId = null,
  onSkipPickup,
  canSkipPickup,
  pendingSkipPickupKeys,
}: {
  row: HaulingChecklistRow;
  items: CargoLine[];
  role: "pickup" | "delivery" | null;
  pendingCargoKeys?: ReadonlySet<string>;
  onToggleCargoHandled?: (
    rowId: string,
    cargoIndex: number,
  ) => void | Promise<void>;
  missionId?: string | null;
  onSkipPickup?: (missionId: string, commoditySlug: string) => void;
  canSkipPickup?: (missionId: string, commoditySlug: string) => boolean;
  pendingSkipPickupKeys?: ReadonlySet<string>;
}) {
  const doneClass = row.isCompleted ? "opacity-70" : "";
  const isPickup = role === "pickup";
  const handledVerb = isPickup ? "picked up" : "delivered";

  return (
    <div className="@container/cargo grid w-full grid-cols-3 gap-2 md:gap-2.5">
      {items.map((line, index) => (
        <CargoCommodityTile
          key={`${row.id}-${role ?? "none"}-${line.commoditySlug}-${line.scu}-${line.sourceIndex ?? index}`}
          row={row}
          line={line}
          isPickup={isPickup}
          handledVerb={handledVerb}
          doneClass={doneClass}
          pendingCargoKeys={pendingCargoKeys}
          onToggleCargoHandled={onToggleCargoHandled}
          missionId={missionId}
          onSkipPickup={onSkipPickup}
          canSkipPickup={canSkipPickup}
          pendingSkipPickupKeys={pendingSkipPickupKeys}
        />
      ))}
    </div>
  );
}

type MissionCargoOption = {
  commoditySlug: string;
  commodity: string;
  /** Mission commodity total — pick-up at this stop cannot exceed it. */
  maxScu: number;
};

/** Mission commodities not already shown as active pick-up tiles at this stop. */
function addableMissionCargo(
  mission: SessionMission,
  activeCommoditySlugs: ReadonlySet<string>,
): MissionCargoOption[] {
  const options: MissionCargoOption[] = [];
  const seen = new Set<string>();
  for (const line of mission.cargo) {
    const slug = commoditySlugOf(line.commodity);
    const maxScu = Math.max(0, Math.floor(Number(line.scu) || 0));
    if (!slug || seen.has(slug) || activeCommoditySlugs.has(slug)) continue;
    if (maxScu <= 0) continue;
    seen.add(slug);
    options.push({
      commoditySlug: slug,
      commodity: line.commodity,
      maxScu,
    });
  }
  return options;
}

function AddPickupCargoForm({
  missionId,
  options,
  locationSlug,
  pendingAddPickupKeys,
  onAddPickup,
}: {
  missionId: string;
  options: MissionCargoOption[];
  locationSlug: string;
  pendingAddPickupKeys?: ReadonlySet<string>;
  onAddPickup: (
    missionId: string,
    commoditySlug: string,
    scu: number,
  ) => void;
}) {
  const [commoditySlug, setCommoditySlug] = useState(
    options[0]?.commoditySlug ?? "",
  );
  const selected =
    options.find((option) => option.commoditySlug === commoditySlug) ??
    options[0] ??
    null;
  const maxScu = selected?.maxScu ?? 1;
  const [scuText, setScuText] = useState(String(Math.min(1, maxScu)));

  useEffect(() => {
    if (
      commoditySlug &&
      options.some((option) => option.commoditySlug === commoditySlug)
    ) {
      return;
    }
    setCommoditySlug(options[0]?.commoditySlug ?? "");
  }, [commoditySlug, options]);

  useEffect(() => {
    const parsed = Math.max(0, Math.floor(Number(scuText) || 0));
    if (parsed > maxScu) setScuText(String(maxScu));
  }, [maxScu, scuText]);

  if (options.length === 0 || !selected) return null;

  const pendingKey = `${missionId}::${commoditySlug}::${locationSlug}`;
  const isPending = Boolean(
    commoditySlug && pendingAddPickupKeys?.has(pendingKey),
  );
  const scu = Math.min(
    maxScu,
    Math.max(0, Math.floor(Number(scuText) || 0)),
  );
  const canSubmit = Boolean(commoditySlug) && scu > 0 && !isPending;

  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-rsi-border/50 pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        onAddPickup(missionId, commoditySlug, scu);
      }}
      aria-label="Add pick-up cargo"
    >
      <label className="sr-only" htmlFor={`add-pickup-${missionId}`}>
        Cargo type
      </label>
      <select
        id={`add-pickup-${missionId}`}
        value={commoditySlug}
        disabled={isPending}
        onChange={(event) => setCommoditySlug(event.target.value)}
        className="min-w-0 flex-1 rounded-rsi border border-rsi-border bg-rsi-bg-deep/70 px-2 py-1 font-mono text-[0.55rem] tracking-wide text-rsi-text outline-none focus:border-rsi-accent"
      >
        {options.map((option) => (
          <option key={option.commoditySlug} value={option.commoditySlug}>
            {option.commodity}
          </option>
        ))}
      </select>
      <label className="inline-flex items-center gap-1">
        <span className="sr-only">SCU</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={maxScu}
          step={1}
          value={scuText}
          disabled={isPending}
          aria-label={`Pick up SCU (max ${maxScu})`}
          title={`Max ${maxScu} SCU (mission total)`}
          onChange={(event) => setScuText(event.target.value)}
          className="w-14 rounded-rsi border border-rsi-border bg-rsi-bg-deep/70 px-2 py-1 font-mono text-[0.65rem] tabular-nums text-rsi-text outline-none focus:border-rsi-accent"
        />
        <span className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-rsi-text-muted">
          SCU
        </span>
      </label>
      <Button
        type="submit"
        variant="ghost"
        disabled={!canSubmit}
        aria-busy={isPending || undefined}
        className="!min-h-0 !px-2 !py-1 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-accent"
      >
        {isPending ? <Spinner className="size-2.5" label="Adding" /> : "Add"}
      </Button>
    </form>
  );
}

function MissionStopCargoCard({
  row,
  mission,
  role,
  sessionId,
  tiles,
  addOptions,
  onAddPickup,
  pendingAddPickupKeys,
}: {
  row: HaulingChecklistRow;
  mission: SessionMission;
  role: "pickup" | "delivery" | null;
  sessionId?: string | null;
  tiles: ReactNode;
  addOptions: MissionCargoOption[];
  onAddPickup?: (
    missionId: string,
    commoditySlug: string,
    scu: number,
  ) => void;
  pendingAddPickupKeys?: ReadonlySet<string>;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const canAdd =
    role === "pickup" && addOptions.length > 0 && Boolean(onAddPickup);

  useEffect(() => {
    if (!canAdd) setAddOpen(false);
  }, [canAdd]);

  const rank = resolveMissionRank(mission);
  const title = resolveMissionTitle(mission) || mission.title;
  const reward = missionRewardLabel(mission);
  const exp = estimateMissionHaulingRepXp(mission);
  const headerAccent =
    role === "pickup"
      ? "border-rsi-accent/40"
      : role === "delivery"
        ? "border-rsi-gold/40"
        : "border-rsi-border";
  const sourceRefs = sessionId
    ? screenshotRefsForMission(mission, sessionId)
    : [];

  return (
    <div
      className={[
        "flex h-full min-w-0 flex-col overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface/90",
        mission.isCompleted || row.isCompleted ? "opacity-70" : "",
      ].join(" ")}
    >
      <div className={["min-w-0 border-b px-2.5 py-2", headerAccent].join(" ")}>
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <p
              className={[
                "font-mono text-[0.5rem] tracking-[0.12em]",
                mission.isCompleted ? "text-rsi-text-muted" : "text-rsi-accent",
              ].join(" ")}
            >
              {rank ?? "—"}
            </p>
            <p
              className={[
                "mt-0.5 min-w-0 truncate text-[0.65rem] font-semibold tracking-wide",
                mission.isCompleted ? "text-rsi-text-muted" : "text-rsi-text",
              ].join(" ")}
            >
              {title || mission.title}
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1">
            {canAdd ? (
              <button
                type="button"
                title={addOpen ? "Hide add cargo" : "Add cargo"}
                aria-label={addOpen ? "Hide add cargo" : "Add cargo"}
                aria-expanded={addOpen}
                onClick={() => setAddOpen((open) => !open)}
                className={[
                  "inline-flex size-6 items-center justify-center rounded-rsi border transition-colors md:size-4",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                  addOpen
                    ? "border-rsi-accent/60 bg-rsi-accent/10 text-rsi-accent"
                    : "border-rsi-border bg-rsi-surface text-rsi-text-secondary hover:border-rsi-accent/50 hover:text-rsi-accent",
                ].join(" ")}
              >
                <PlusIcon className="size-3 md:size-2" />
              </button>
            ) : null}
            {sourceRefs.length > 0 ? (
              <StopMissionScreenshots
                refs={sourceRefs}
                variant="inline"
                className="shrink-0"
              />
            ) : null}
          </div>
        </div>
        {reward !== "—" || exp != null ? (
          <p className="mt-1 flex min-w-0 items-baseline justify-between gap-2 font-mono text-[0.55rem] tabular-nums tracking-wide text-rsi-text-secondary">
            <span className="min-w-0 truncate">
              {reward !== "—" ? reward : null}
            </span>
            {exp != null ? (
              <span
                className="shrink-0"
                title={`Approximate Covalex hauling reputation XP: ${exp.toLocaleString("en-US")}`}
              >
                {formatHaulingRepXp(exp)} XP
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
      <div className="mt-auto shrink-0 bg-rsi-bg-deep/35 p-2.5">
        {tiles}
        {canAdd && addOpen && onAddPickup ? (
          <AddPickupCargoForm
            missionId={mission.id}
            options={addOptions}
            locationSlug={row.locationSlug}
            pendingAddPickupKeys={pendingAddPickupKeys}
            onAddPickup={(missionId, commoditySlug, scu) => {
              onAddPickup(missionId, commoditySlug, scu);
              setAddOpen(false);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function CargoGroups({
  row,
  cargoLines,
  missions,
  location,
  shipName,
  shipSlug = null,
  sessionId = null,
  transferLedger,
  pendingCargoKeys,
  onToggleCargoHandled,
  bayAside,
  onSkipPickup,
  canSkipPickup,
  pendingSkipPickupKeys,
  onAddPickup,
  pendingAddPickupKeys,
}: {
  row: HaulingChecklistRow;
  cargoLines: CargoLine[];
  missions: SessionMission[];
  location: string;
  shipName: string;
  shipSlug?: string | null;
  sessionId?: string | null;
  transferLedger?: StopTransferLedger | null;
  pendingCargoKeys?: ReadonlySet<string>;
  onToggleCargoHandled?: (
    rowId: string,
    cargoIndex: number,
  ) => void | Promise<void>;
  /** Pad graph beside Pickup / Drop off — tops align with each section. */
  bayAside?: (role: "pickup" | "delivery") => ReactNode;
  /**
   * Skip pick-up of one cargo at this stop (mission-card ×). Remaining
   * pick-up stops absorb the SCU.
   */
  onSkipPickup?: (missionId: string, commoditySlug: string) => void;
  canSkipPickup?: (missionId: string, commoditySlug: string) => boolean;
  /** Pending keys `missionId::commoditySlug::locationSlug`. */
  pendingSkipPickupKeys?: ReadonlySet<string>;
  /** Add / restore a mission commodity pick-up at this stop with an SCU amount. */
  onAddPickup?: (
    missionId: string,
    commoditySlug: string,
    scu: number,
  ) => void;
  pendingAddPickupKeys?: ReadonlySet<string>;
}) {
  const groups = groupCargoLines(cargoLines);
  const missionById = new Map(missions.map((mission) => [mission.id, mission]));
  const pickupTransfer =
    transferLedger != null && transferLedger.pickup !== false
      ? transferLedger.pickup
      : false;
  const deliveryTransfer =
    transferLedger != null && transferLedger.delivery !== false
      ? transferLedger.delivery
      : false;
  const hasPickupGroup = groups.some((group) => group.role === "pickup");
  const hasDeliveryGroup = groups.some((group) => group.role === "delivery");

  return (
    <div className="flex flex-col gap-5 text-sm md:gap-2">
      {groups.map((group, groupIndex) => {
        const roleClass =
          group.role === "pickup"
            ? "text-rsi-accent"
            : group.role === "delivery"
              ? "text-rsi-gold"
              : "text-rsi-text-muted";
        const prevRole = groups[groupIndex - 1]?.role;
        const showRoleDivider =
          groupIndex > 0 &&
          prevRole != null &&
          group.role != null &&
          prevRole !== group.role;

        if (group.items.length === 1 && group.items[0]?.scu == null) {
          return (
            <span
              key={`${row.id}-cargo-empty`}
              className={[
                "text-rsi-text-secondary",
                row.isCompleted ? "opacity-70" : "",
              ].join(" ")}
            >
              —
            </span>
          );
        }

        const missionBuckets = partitionCargoByMission(
          group.items,
          row,
          missions,
          group.role,
        );
        const sectionTransfer =
          group.role === "pickup" && pickupTransfer
            ? (
                <PickupTransferBlock
                  location={location}
                  locationSlug={row.locationSlug}
                  shipName={shipName}
                  shipSlug={shipSlug}
                  transfer={pickupTransfer}
                  isDone={row.isCompleted}
                />
              )
            : group.role === "delivery" && deliveryTransfer
              ? (
                  <DeliveryTransferBlock
                    location={location}
                    locationSlug={row.locationSlug}
                    shipName={shipName}
                    shipSlug={shipSlug}
                    transfer={deliveryTransfer}
                    isDone={row.isCompleted}
                  />
                )
              : null;

        const sectionBody = (
          <div className="flex w-full min-w-0 flex-col gap-2 lg:flex-1">
            {sectionTransfer}
            <div className="grid grid-cols-1 gap-2 min-[450px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-2">
              {missionBuckets.map((bucket) => {
                // Skipped pick-ups stay at 0 SCU on the row — hide those tiles.
                const activeItems = bucket.items.filter(
                  (item) => (item.scu ?? 0) > 0,
                );
                const activeSlugs = new Set(
                  activeItems
                    .map((item) => item.commoditySlug)
                    .filter((slug): slug is string => Boolean(slug)),
                );

                const mission =
                  bucket.missionId != null
                    ? (missionById.get(bucket.missionId) ?? null)
                    : null;
                const addOptions =
                  group.role === "pickup" &&
                  mission &&
                  onAddPickup &&
                  !mission.isCompleted &&
                  !row.isCompleted
                    ? addableMissionCargo(mission, activeSlugs)
                    : [];
                if (activeItems.length === 0 && addOptions.length === 0) {
                  return null;
                }

                const tiles =
                  activeItems.length > 0 ? (
                    <CargoCommodityTiles
                      row={row}
                      items={activeItems}
                      role={group.role}
                      pendingCargoKeys={pendingCargoKeys}
                      onToggleCargoHandled={onToggleCargoHandled}
                      missionId={bucket.missionId}
                      onSkipPickup={
                        group.role === "pickup" ? onSkipPickup : undefined
                      }
                      canSkipPickup={
                        group.role === "pickup" ? canSkipPickup : undefined
                      }
                      pendingSkipPickupKeys={
                        group.role === "pickup"
                          ? pendingSkipPickupKeys
                          : undefined
                      }
                    />
                  ) : null;

                if (!mission) {
                  return (
                    <div
                      key={`${row.id}-${group.role ?? "none"}-untagged`}
                      className="min-w-0"
                    >
                      {tiles}
                    </div>
                  );
                }

                return (
                  <MissionStopCargoCard
                    key={`${row.id}-${group.role ?? "none"}-${mission.id}`}
                    row={row}
                    mission={mission}
                    role={group.role}
                    sessionId={sessionId}
                    tiles={tiles}
                    addOptions={addOptions}
                    onAddPickup={onAddPickup}
                    pendingAddPickupKeys={pendingAddPickupKeys}
                  />
                );
              })}
            </div>
          </div>
        );

        const sectionAside =
          group.role === "pickup" || group.role === "delivery"
            ? bayAside?.(group.role)
            : null;

        return (
          <div
            key={`${row.id}-cargo-${group.role ?? "none"}`}
            className={[
              "flex flex-col gap-2",
              showRoleDivider
                ? "border-t border-rsi-divider pt-2 lg:pt-1.5"
                : "",
            ].join(" ")}
          >
            {group.role ? (
              <span
                className={[
                  "w-fit border-b pb-0.5 font-mono text-[0.65rem] uppercase tracking-[0.16em]",
                  roleClass,
                  group.role === "pickup"
                    ? "border-rsi-accent/45"
                    : "border-rsi-gold/45",
                ].join(" ")}
              >
                {group.role === "pickup" ? "Pick up" : "Drop off"}
              </span>
            ) : null}
            {/* Role label sits above so transfer + Breakdown tops line up;
                stretch keeps the pad graph filling the left column height. */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
              {sectionBody}
              {sectionAside ? (
                <div className="flex min-h-0 w-full min-w-0 flex-col lg:w-1/2 lg:shrink-0 lg:[&>*]:h-full lg:[&>*]:min-h-0">
                  {sectionAside}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
      {!hasDeliveryGroup && deliveryTransfer ? (
        <DeliveryTransferBlock
          location={location}
          locationSlug={row.locationSlug}
          shipName={shipName}
          shipSlug={shipSlug}
          transfer={deliveryTransfer}
          isDone={row.isCompleted}
        />
      ) : null}
      {!hasPickupGroup && pickupTransfer ? (
        <PickupTransferBlock
          location={location}
          locationSlug={row.locationSlug}
          shipName={shipName}
          shipSlug={shipSlug}
          transfer={pickupTransfer}
          isDone={row.isCompleted}
        />
      ) : null}
    </div>
  );
}
