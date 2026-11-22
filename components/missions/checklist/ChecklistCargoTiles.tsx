"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { describeCargoDeliveries, getCommodityIconSrc } from "@/lib/fixtures";
import {
  commodityBadgeBackground,
  commodityBadgeBorder,
  commodityBadgeForeground,
  resolveCommodityColorHex,
} from "@/lib/fixtures/commodityColors";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";
import type { StopTransferLedger } from "@/lib/missions/cargoInventory";
import { stopCargoRole } from "@/lib/missions/stopDeliveryBoxes";
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
  const order: ("pickup" | "delivery" | null)[] = [
    "delivery",
    "pickup",
    null,
  ];
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

function cargoRoleTabLabel(role: "pickup" | "delivery"): string {
  return role === "pickup" ? "Pick up" : "Drop off";
}

export function CargoTileHandledMark() {
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
          fill="var(--rsi-success)"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="1"
        />
        <path
          d="M6.2 10.1 L8.7 12.5 L13.8 7.4"
          fill="none"
          stroke="var(--rsi-bg-deep)"
          strokeWidth="1.85"
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
  onSetPickupScu,
  pendingSetPickupScuKeys,
  maxPickupScu = null,
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
  /** Set pick-up SCU at this stop; remaining pick-ups rebalance. */
  onSetPickupScu?: (
    missionId: string,
    commoditySlug: string,
    scu: number,
  ) => void;
  pendingSetPickupScuKeys?: ReadonlySet<string>;
  /** Mission commodity total — edit cannot exceed it. */
  maxPickupScu?: number | null;
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
  const currentScu = Math.max(0, Math.floor(Number(line.scu) || 0));
  const skipAllowed =
    isPickup &&
    Boolean(onSkipPickup) &&
    Boolean(missionId) &&
    commoditySlug.length > 0 &&
    currentScu > 0 &&
    !row.isCompleted;
  const canSkip =
    skipAllowed && (canSkipPickup?.(missionId!, commoditySlug) ?? false);
  const skipPendingKey =
    missionId && commoditySlug
      ? `${missionId}::${commoditySlug}::${row.locationSlug}`
      : null;
  const isSkipPending = Boolean(
    skipPendingKey && pendingSkipPickupKeys?.has(skipPendingKey),
  );
  const isSetScuPending = Boolean(
    skipPendingKey && pendingSetPickupScuKeys?.has(skipPendingKey),
  );
  const canEditPickupScu =
    isPickup &&
    Boolean(onSetPickupScu) &&
    Boolean(missionId) &&
    commoditySlug.length > 0 &&
    currentScu > 0 &&
    !row.isCompleted &&
    !isSkipPending &&
    !isSetScuPending;
  const [isEditingScu, setIsEditingScu] = useState(false);
  const [scuText, setScuText] = useState(String(currentScu));
  const scuInputRef = useRef<HTMLInputElement>(null);
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
  const statusSuffix = isCargoPending || isSetScuPending
    ? "updating…"
    : cleared
      ? `marked ${handledVerb}`
      : `click to mark ${handledVerb}`;
  const scuEditHint = canEditPickupScu
    ? "Double-click SCU to edit — remaining pickups rebalance"
    : null;

  useEffect(() => {
    if (isEditingScu) return;
    setScuText(String(currentScu));
  }, [currentScu, isEditingScu]);

  useEffect(() => {
    if (!isEditingScu) return;
    const node = scuInputRef.current;
    if (!node) return;
    node.focus();
    node.select();
  }, [isEditingScu]);

  const commitPickupScu = () => {
    setIsEditingScu(false);
    if (!canEditPickupScu || !missionId || !commoditySlug) return;
    const maxScu =
      maxPickupScu != null && maxPickupScu > 0
        ? Math.floor(maxPickupScu)
        : currentScu;
    const parsed = Math.min(
      maxScu,
      Math.max(0, Math.floor(Number(scuText) || 0)),
    );
    setScuText(String(parsed));
    if (parsed === currentScu) return;
    onSetPickupScu?.(missionId, commoditySlug, parsed);
  };

  const tileClassName = [
    // Commodity icon sits top-left; SCU + name stay centered. Density follows cargo @container.
    // Cap size so wide mission cards don’t grow huge squares; keep 1:1 via aspect + max-w.
    "relative mx-auto flex aspect-square w-full max-w-28 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-rsi border px-1 pb-1 pt-2 font-mono font-medium tabular-nums",
    "md:gap-0.5 md:px-1 md:pb-1 md:pt-2.5",
    "md:@[13rem]/cargo:gap-0.5 md:@[13rem]/cargo:px-1 md:@[13rem]/cargo:pb-1.5 md:@[13rem]/cargo:pt-3",
    "md:@[17rem]/cargo:gap-1 md:@[17rem]/cargo:px-1.5 md:@[17rem]/cargo:pb-2 md:@[17rem]/cargo:pt-3",
    "transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
    isCargoPending || isSetScuPending
      ? "cursor-wait"
      : canToggle && !isEditingScu
        ? "cursor-pointer"
        : "cursor-default",
    doneClass,
    cleared && !isCargoPending && !isSetScuPending ? "opacity-40" : "",
  ].join(" ");

  const tileStyle = {
    backgroundColor: tileBg,
    borderColor: tileBorder,
    color: tileFg,
  };

  const iconMaskStyle = {
    WebkitMaskImage: `url(${iconSrc})`,
    maskImage: `url(${iconSrc})`,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  } as const;

  const scuNumberClass =
    "text-sm font-semibold leading-none md:text-[0.6rem] md:@[17rem]/cargo:text-[0.65rem]";

  return (
    <div className="relative min-w-0">
      {skipAllowed && missionId ? (
        <button
          type="button"
          aria-label={`Skip pick up of ${commodityName} at this stop`}
          aria-busy={isSkipPending || undefined}
          disabled={isSkipPending || !canSkip || isEditingScu}
          title={
            canSkip
              ? "Skip pick up — remaining stops absorb this SCU"
              : "Can't skip — this is the only pick-up stop for this cargo"
          }
          className={[
            "absolute top-0.5 right-0.5 z-10 inline-flex size-5 items-center justify-center rounded-sm border-0 bg-transparent font-mono text-[0.85rem] leading-none shadow-none transition-colors",
            "text-rsi-text",
            isSkipPending
              ? "cursor-wait opacity-70"
              : canSkip
                ? "hover:bg-rsi-danger-muted hover:text-rsi-danger"
                : "cursor-not-allowed opacity-35",
          ].join(" ")}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (isSkipPending || !canSkip || isEditingScu) return;
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
      {isEditingScu ? (
        <div
          className={tileClassName}
          style={tileStyle}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute top-1 left-1 size-3 shrink-0 bg-current opacity-90 md:size-2.5 md:@[17rem]/cargo:size-3"
            style={iconMaskStyle}
          />
          <label className="sr-only" htmlFor={`pickup-scu-${row.id}-${commoditySlug}`}>
            {commodityName} pick-up SCU
          </label>
          <input
            ref={scuInputRef}
            id={`pickup-scu-${row.id}-${commoditySlug}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={maxPickupScu != null && maxPickupScu > 0 ? maxPickupScu : undefined}
            step={1}
            value={scuText}
            aria-label={`${commodityName} pick-up SCU`}
            className={[
              scuNumberClass,
              "w-[2.75rem] rounded-sm border border-rsi-accent/55 bg-rsi-bg-deep/70 px-0.5 py-0.5 text-center tabular-nums text-rsi-text outline-none focus:border-rsi-accent",
            ].join(" ")}
            onChange={(event) => setScuText(event.target.value)}
            onBlur={commitPickupScu}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                (event.target as HTMLInputElement).blur();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setScuText(String(currentScu));
                setIsEditingScu(false);
              }
            }}
          />
          <span className="line-clamp-2 w-full min-w-0 text-center text-[0.55rem] leading-snug tracking-wide break-words opacity-90 normal-case md:text-[0.5rem] md:@[13rem]/cargo:text-[0.5rem] md:@[17rem]/cargo:text-[0.55rem]">
            {commodityName}
          </span>
        </div>
      ) : (
        <button
          type="button"
          title={[fullLabel, scuEditHint, statusSuffix]
            .filter(Boolean)
            .join(" · ")}
          aria-label={fullLabel}
          aria-pressed={cleared}
          aria-busy={isCargoPending || isSetScuPending || undefined}
          disabled={!canToggle && !isCargoPending && !isSetScuPending}
          onClick={(event) => {
            event.stopPropagation();
            if (line.sourceIndex == null || isCargoPending || isSetScuPending)
              return;
            void onToggleCargoHandled?.(row.id, line.sourceIndex);
          }}
          className={tileClassName}
          style={tileStyle}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute top-1 left-1 size-3 shrink-0 bg-current opacity-90 md:size-2.5 md:@[17rem]/cargo:size-3"
            style={iconMaskStyle}
          />
          <span
            className={[
              scuNumberClass,
              canEditPickupScu ? "rounded-sm hover:ring-1 hover:ring-rsi-accent/40" : "",
            ].join(" ")}
            title={scuEditHint ?? undefined}
            onClick={(event) => {
              if (!canEditPickupScu) return;
              // Keep double-click from toggling handled on the tile button.
              event.stopPropagation();
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!canEditPickupScu) return;
              setScuText(String(currentScu));
              setIsEditingScu(true);
            }}
          >
            {line.scu}
          </span>
          <span className="line-clamp-2 w-full min-w-0 text-center text-[0.55rem] leading-snug tracking-wide break-words opacity-90 normal-case md:text-[0.5rem] md:@[13rem]/cargo:text-[0.5rem] md:@[17rem]/cargo:text-[0.55rem]">
            {commodityName}
          </span>
          {isCargoPending || isSetScuPending ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-rsi bg-rsi-bg-deep/55"
            >
              <Spinner className="size-3.5 text-rsi-accent" />
            </span>
          ) : cleared ? (
            <CargoTileHandledMark />
          ) : null}
        </button>
      )}
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
  onSetPickupScu,
  pendingSetPickupScuKeys,
  maxPickupScuBySlug = null,
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
  onSetPickupScu?: (
    missionId: string,
    commoditySlug: string,
    scu: number,
  ) => void;
  pendingSetPickupScuKeys?: ReadonlySet<string>;
  maxPickupScuBySlug?: ReadonlyMap<string, number> | null;
}) {
  const doneClass = row.isCompleted ? "opacity-70" : "";
  const isPickup = role === "pickup";
  const handledVerb = isPickup ? "picked up" : "delivered";

  return (
    <div className="@container/cargo grid w-full grid-cols-3 gap-2 md:gap-2.5 lg:grid-cols-2 min-[1150px]:grid-cols-3">
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
          onSetPickupScu={isPickup ? onSetPickupScu : undefined}
          pendingSetPickupScuKeys={
            isPickup ? pendingSetPickupScuKeys : undefined
          }
          maxPickupScu={
            isPickup && line.commoditySlug
              ? (maxPickupScuBySlug?.get(line.commoditySlug) ?? null)
              : null
          }
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
  const showAddControl =
    role === "pickup" &&
    Boolean(onAddPickup) &&
    !mission.isCompleted &&
    !row.isCompleted;
  const canAdd = showAddControl && addOptions.length > 0;

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
        "flex min-w-0 flex-col self-start overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface/90",
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
            {showAddControl ? (
              <button
                type="button"
                title={
                  canAdd
                    ? addOpen
                      ? "Hide add cargo"
                      : "Add cargo"
                    : "All mission cargo is already on this stop"
                }
                aria-label={
                  canAdd
                    ? addOpen
                      ? "Hide add cargo"
                      : "Add cargo"
                    : "Add cargo unavailable"
                }
                aria-expanded={canAdd ? addOpen : undefined}
                disabled={!canAdd}
                onClick={() => {
                  if (!canAdd) return;
                  setAddOpen((open) => !open);
                }}
                className={[
                  "inline-flex size-6 items-center justify-center rounded-rsi border transition-colors md:size-4",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
                  !canAdd
                    ? "cursor-not-allowed border-rsi-border/50 bg-rsi-surface/40 text-rsi-text-muted opacity-50"
                    : addOpen
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
  onSetPickupScu,
  pendingSetPickupScuKeys,
  prioritizePickup = true,
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
  /**
   * Edit pick-up SCU on a cargo tile (double-click number → blur).
   * Remaining pick-up stops rebalance for that commodity.
   */
  onSetPickupScu?: (
    missionId: string,
    commoditySlug: string,
    scu: number,
  ) => void;
  pendingSetPickupScuKeys?: ReadonlySet<string>;
  /**
   * When true, Pick up is the left tab (and preferred when both are open).
   * Default: Pick up left, Drop off right.
   */
  prioritizePickup?: boolean;
}) {
  const deliveryHandled =
    stopCargoRole.isHandled(row, "delivery") || row.isCompleted;
  const pickupHandled =
    stopCargoRole.isHandled(row, "pickup") || row.isCompleted;
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
  const hasPickupSection = hasPickupGroup || Boolean(pickupTransfer);
  const hasDeliverySection = hasDeliveryGroup || Boolean(deliveryTransfer);
  const showRoleTabs = hasPickupSection && hasDeliverySection;
  /** Preferred first tab when both roles are still open. */
  const preferredRole: "pickup" | "delivery" = prioritizePickup
    ? "pickup"
    : "delivery";

  const roleDefault = (): "pickup" | "delivery" => {
    if (showRoleTabs) {
      if (deliveryHandled && !pickupHandled) return "pickup";
      if (pickupHandled && !deliveryHandled) return "delivery";
      return preferredRole;
    }
    if (hasPickupSection && !hasDeliverySection) return "pickup";
    return "delivery";
  };

  const [activeRole, setActiveRole] = useState<"pickup" | "delivery">(roleDefault);

  useEffect(() => {
    if (!showRoleTabs) {
      setActiveRole(hasPickupSection ? "pickup" : "delivery");
      return;
    }
    if (deliveryHandled && !pickupHandled) setActiveRole("pickup");
    else if (pickupHandled && !deliveryHandled) setActiveRole("delivery");
    else setActiveRole(preferredRole);
  }, [
    showRoleTabs,
    hasPickupSection,
    deliveryHandled,
    pickupHandled,
    preferredRole,
  ]);

  const cargoPanelsRef = useRef<HTMLDivElement | null>(null);
  const [graphMinHeightPx, setGraphMinHeightPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!showRoleTabs) {
      setGraphMinHeightPx(null);
      return;
    }
    const root = cargoPanelsRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const isDesktop =
        typeof window !== "undefined" &&
        window.matchMedia("(min-width: 1024px)").matches;
      if (!isDesktop) {
        setGraphMinHeightPx(null);
        return;
      }
      let max = 0;
      for (const panel of root.querySelectorAll("[data-cargo-role-panel]")) {
        const transfer = panel.querySelector("[data-cargo-transfer]");
        const firstCard = panel.querySelector("[data-cargo-cards] > *");
        const transferH =
          transfer instanceof HTMLElement ? transfer.offsetHeight : 0;
        const cardH =
          firstCard instanceof HTMLElement ? firstCard.offsetHeight : 0;
        const gap = transferH > 0 && cardH > 0 ? 8 : 0;
        max = Math.max(max, transferH + gap + cardH);
      }
      setGraphMinHeightPx(max > 0 ? max : null);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [showRoleTabs, activeRole, prioritizePickup, cargoLines, transferLedger]);

  const renderRoleSection = (
    role: "pickup" | "delivery" | null,
    options?: { withAside?: boolean },
  ) => {
    const withAside = options?.withAside !== false;
    const group =
      groups.find((entry) => entry.role === role) ??
      (role == null ? groups.find((entry) => entry.role == null) : undefined);

    if (role == null) {
      if (!group) return null;
      if (group.items.length === 1 && group.items[0]?.scu == null) {
        return (
          <span
            className={[
              "text-rsi-text-secondary",
              row.isCompleted ? "opacity-70" : "",
            ].join(" ")}
          >
            —
          </span>
        );
      }
      return null;
    }

    const roleHandled = role === "pickup" ? pickupHandled : deliveryHandled;
    const hasGroup = role === "pickup" ? hasPickupGroup : hasDeliveryGroup;
    const hasTransfer =
      role === "pickup" ? Boolean(pickupTransfer) : Boolean(deliveryTransfer);

    if (!hasGroup && !hasTransfer) return null;

    if (group && group.items.length === 1 && group.items[0]?.scu == null) {
      return (
        <span
          className={[
            "text-rsi-text-secondary",
            row.isCompleted ? "opacity-70" : "",
          ].join(" ")}
        >
          —
        </span>
      );
    }

    const missionBuckets = group
      ? partitionCargoByMission(group.items, row, missions, role)
      : [];

    const sectionTransfer =
      role === "pickup" && pickupTransfer ? (
        <PickupTransferBlock
          location={location}
          locationSlug={row.locationSlug}
          shipName={shipName}
          shipSlug={shipSlug}
          transfer={pickupTransfer}
          isDone={pickupHandled}
        />
      ) : role === "delivery" && deliveryTransfer ? (
        <DeliveryTransferBlock
          location={location}
          locationSlug={row.locationSlug}
          shipName={shipName}
          shipSlug={shipSlug}
          transfer={deliveryTransfer}
          isDone={deliveryHandled}
        />
      ) : null;

    const sectionBody = (
      <div className="flex w-full min-w-0 flex-col gap-2 lg:flex-1">
        {sectionTransfer ? (
          <div data-cargo-transfer>{sectionTransfer}</div>
        ) : null}
        {missionBuckets.length > 0 ? (
          <div
            data-cargo-cards
            className="grid grid-cols-1 items-start gap-2 min-[450px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-2"
          >
            {missionBuckets.map((bucket) => {
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
                role === "pickup" &&
                mission &&
                onAddPickup &&
                !mission.isCompleted &&
                !row.isCompleted
                  ? addableMissionCargo(mission, activeSlugs)
                  : [];
              if (activeItems.length === 0 && addOptions.length === 0) {
                return null;
              }

              const maxPickupScuBySlug =
                role === "pickup" && mission
                  ? new Map(
                      mission.cargo.map((cargoLine) => [
                        commoditySlugOf(cargoLine.commodity),
                        Math.max(0, Math.floor(Number(cargoLine.scu) || 0)),
                      ]),
                    )
                  : null;

              const tiles =
                activeItems.length > 0 ? (
                  <CargoCommodityTiles
                    row={row}
                    items={activeItems}
                    role={role}
                    pendingCargoKeys={pendingCargoKeys}
                    onToggleCargoHandled={onToggleCargoHandled}
                    missionId={bucket.missionId}
                    onSkipPickup={role === "pickup" ? onSkipPickup : undefined}
                    canSkipPickup={
                      role === "pickup" ? canSkipPickup : undefined
                    }
                    pendingSkipPickupKeys={
                      role === "pickup" ? pendingSkipPickupKeys : undefined
                    }
                    onSetPickupScu={
                      role === "pickup" ? onSetPickupScu : undefined
                    }
                    pendingSetPickupScuKeys={
                      role === "pickup" ? pendingSetPickupScuKeys : undefined
                    }
                    maxPickupScuBySlug={maxPickupScuBySlug}
                  />
                ) : null;

              if (!mission) {
                return (
                  <div
                    key={`${row.id}-${role}-untagged`}
                    className="min-w-0"
                  >
                    {tiles}
                  </div>
                );
              }

              return (
                <MissionStopCargoCard
                  key={`${row.id}-${role}-${mission.id}`}
                  row={row}
                  mission={mission}
                  role={role}
                  sessionId={sessionId}
                  tiles={tiles}
                  addOptions={addOptions}
                  onAddPickup={onAddPickup}
                  pendingAddPickupKeys={pendingAddPickupKeys}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    );

    const sectionAside = withAside ? bayAside?.(role) : null;

    return (
      <div
        key={`${row.id}-cargo-${role}`}
        role={showRoleTabs ? "tabpanel" : undefined}
        id={showRoleTabs ? `${row.id}-cargo-panel-${role}` : undefined}
        aria-labelledby={
          showRoleTabs ? `${row.id}-cargo-tab-${role}` : undefined
        }
        className="flex flex-col gap-2"
      >
        {!showRoleTabs ? (
          <span
            className={[
              "w-fit border-b pb-0.5 font-mono text-[0.65rem] uppercase tracking-[0.16em]",
              role === "pickup" ? "text-rsi-accent" : "text-rsi-gold",
              role === "pickup" ? "border-rsi-accent/45" : "border-rsi-gold/45",
              roleHandled ? "opacity-70" : "",
            ].join(" ")}
          >
            {cargoRoleTabLabel(role)}
          </span>
        ) : null}
        {withAside ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
            {sectionBody}
            {sectionAside ? (
              <div className="flex min-h-0 w-full min-w-0 flex-col lg:w-1/2 lg:shrink-0 lg:[&>*]:h-full lg:[&>*]:min-h-0">
                {sectionAside}
              </div>
            ) : null}
          </div>
        ) : (
          sectionBody
        )}
      </div>
    );
  };

  const tabRoles = (
    prioritizePickup
      ? (["pickup", "delivery"] as const)
      : (["delivery", "pickup"] as const)
  ).filter((role) =>
    role === "pickup" ? hasPickupSection : hasDeliverySection,
  );

  const roleTabs = showRoleTabs ? (
    <div
      role="tablist"
      aria-label="Stop cargo actions"
      className="flex min-w-0 items-stretch gap-1 border-b border-rsi-divider"
    >
      {tabRoles.map((role) => {
        const isActive = activeRole === role;
        const isDone = role === "pickup" ? pickupHandled : deliveryHandled;
        return (
          <button
            key={role}
            type="button"
            role="tab"
            id={`${row.id}-cargo-tab-${role}`}
            aria-selected={isActive}
            aria-controls={`${row.id}-cargo-panel-${role}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => setActiveRole(role)}
            className={[
              "relative -mb-px inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2.5 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rsi-ring)]",
              isActive
                ? role === "pickup"
                  ? "border-b-2 border-rsi-accent text-rsi-accent"
                  : "border-b-2 border-rsi-gold text-rsi-gold"
                : "border-b-2 border-transparent text-rsi-text-muted hover:text-rsi-text-secondary",
              isDone && !isActive ? "opacity-70" : "",
            ].join(" ")}
          >
            <span className="truncate">{cargoRoleTabLabel(role)}</span>
            {isDone ? (
              <span
                aria-hidden
                className={[
                  "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-rsi-bg-deep shadow-[0_0_0_1px_rgba(0,0,0,0.25)]",
                  isActive
                    ? "bg-rsi-success/80 opacity-90"
                    : "bg-rsi-success/55 opacity-70",
                ].join(" ")}
              >
                <svg
                  viewBox="0 0 12 12"
                  className="size-2.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2.5 6.2 L4.8 8.5 L9.5 3.5" />
                </svg>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  ) : null;

  if (showRoleTabs) {
    /**
     * Desktop: stack both role panels/graphs in one grid cell with
     * `invisible` (not `display:none`) so height stays at the taller
     * role and tab switches don’t jump the scroll. Mobile: only active.
     */
    const desktopEqualHeight = (isActive: boolean) =>
      [
        "min-w-0",
        "lg:col-start-1 lg:row-start-1",
        isActive
          ? ""
          : "hidden lg:block lg:invisible lg:pointer-events-none",
      ]
        .filter(Boolean)
        .join(" ");

    return (
      <div className="flex flex-col gap-3 text-sm lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-4 lg:gap-y-2">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">{roleTabs}</div>
        <div
          ref={cargoPanelsRef}
          className="min-w-0 lg:col-start-1 lg:row-start-2 lg:grid"
        >
          {tabRoles.map((role) => {
            const isActive = role === activeRole;
            return (
              <div
                key={`${row.id}-equal-panel-${role}`}
                data-cargo-role-panel={role}
                className={desktopEqualHeight(isActive)}
                aria-hidden={!isActive}
              >
                {renderRoleSection(role, { withAside: false })}
              </div>
            );
          })}
        </div>
        {/* Min height = transfer + first mission-card row (not the full card grid). */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-2 lg:grid">
          {tabRoles.map((role) => {
            const isActive = role === activeRole;
            const aside = bayAside?.(role);
            if (!aside) return null;
            return (
              <div
                key={`${row.id}-equal-aside-${role}`}
                className={[
                  desktopEqualHeight(isActive),
                  "flex w-full flex-col lg:[&>*]:min-h-0 lg:[&>*]:flex-1",
                ].join(" ")}
                style={
                  graphMinHeightPx != null
                    ? { minHeight: graphMinHeightPx }
                    : undefined
                }
                aria-hidden={!isActive}
              >
                {aside}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      {hasPickupSection
        ? renderRoleSection("pickup")
        : hasDeliverySection
          ? renderRoleSection("delivery")
          : renderRoleSection(null)}
    </div>
  );
}
