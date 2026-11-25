"use client";

import {
  memo,
  startTransition,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CatalogMission } from "@/db/schema";
import {
  CargoAmountBadges,
  CatalogLocationBadges,
} from "@/components/catalog/CatalogRouteBadges";
import { CargoBoxCountIcons } from "@/components/ships/CargoBoxSizeIcon";
import {
  ImageLightbox,
  type ImageLightboxItem,
} from "@/components/ui/ImageLightbox";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { fetchCatalogMissionsByIds } from "@/lib/api/catalogMissionsApi";
import { resolveCommodityColorHex } from "@/lib/fixtures/commodityColors";
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";
import {
  boxCountsFromBreakdown,
} from "@/lib/missions/boxBreakdownOptions";
import {
  scuBoxSplitsForScu,
  type ScuBoxSplits,
} from "@/lib/missions/catalogMission";
import {
  catalogLocationBadgeLabel,
  type CatalogLocationBadgeItem,
} from "@/lib/missions/catalogMissionDisplay";
import { enrichSessionMissionFromCatalog } from "@/lib/missions/enrichSessionMissionFromCatalog";
import {
  resolveMissionRank,
  resolveMissionTitle,
  type MissionRank,
} from "@/lib/missions/missionRank";
import { cargoBoxSplits } from "@/lib/missions/cargoBoxSplits";
import {
  estimateMissionHaulingRepXp,
  formatHaulingRepXp,
} from "@/lib/missions/haulingRepXp";
import {
  isMissionLocationCompleted,
  missionAuecAmount,
  missionCollectObjectives,
  missionDeliverObjectives,
  missionTotalScu,
} from "@/lib/missions/sessionMissionObjectives";
import type { MissionScuDraft } from "@/lib/missions/missionScuAmounts";
import type { HaulingChecklistRow } from "@/lib/missions/sessionChecklist";

import type { SessionMission } from "@/lib/missions/sessionMissions";
import { stopMissionBoxConfigModalProps } from "@/lib/missions/stopMissionBoxConfig";
import { resolveLocationSlug } from "@/lib/sessions/resolveRefs";
import { SessionAcceptedContractsSkeleton } from "./SessionAcceptedContractsSkeleton";
import { StopMissionBoxConfigModal } from "./StopMissionBoxConfigModal";

export type SessionMissionsModalProps = {
  open: boolean;
  missions: SessionMission[];
  /** Route rows — used to resolve per-stop SCU splits for Collect/Deliver. */
  rows?: HaulingChecklistRow[];
  /** Session id — Source screenshot URLs in the box-types modal. */
  sessionId?: string | null;
  /** When set, scroll this contract card into view on open. */
  focusMissionId?: string | null;
  onClose: () => void;
  onToggleHidden: (missionId: string, isHidden: boolean) => void;
  onToggleCompleted: (missionId: string, isCompleted: boolean) => void;
  onRemoveMission: (missionId: string) => void;
  onSelectBoxBreakdown: (
    missionId: string,
    commoditySlug: string,
    breakdown: ScuBoxSplits,
    options?: {
      applyPreferredMaxToRemaining?: boolean;
      onlyUncorrected?: boolean;
    },
  ) => void;
  onSaveMissionScuDraft?: (missionId: string, draft: MissionScuDraft) => void;
};

function EllipsisIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3 w-3"
      fill="currentColor"
    >
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}

function VisibilityIcon({ isHidden }: { isHidden: boolean }) {
  if (isHidden) {
    return (
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CompleteIcon({ isCompleted }: { isCompleted: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {isCompleted ? (
        <>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </>
      ) : (
        <circle cx="12" cy="12" r="9" />
      )}
    </svg>
  );
}

function sessionLocationBadge(
  locationNameOrSlug: string,
  isCompleted: boolean,
): CatalogLocationBadgeItem {
  const slug =
    resolveLocationSlug(locationNameOrSlug) ?? locationNameOrSlug;
  return {
    ...catalogLocationBadgeLabel(slug),
    isCompleted,
  };
}

function formatRewardCell(mission: SessionMission): string {
  const amount = missionAuecAmount(mission);
  if (amount <= 0) return "—";
  return Math.floor(amount).toLocaleString("en-US");
}

function MissionActionsMenu({
  mission,
  onToggleCompleted,
  onToggleHidden,
  onRemoveMission,
}: {
  mission: SessionMission;
  onToggleCompleted: (isCompleted: boolean) => void;
  onToggleHidden: (isHidden: boolean) => void;
  onRemoveMission: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const isHidden = Boolean(mission.isHidden);
  const isCompleted = Boolean(mission.isCompleted);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass = [
    "flex w-full items-center gap-2 px-3 py-2 text-left text-xs tracking-wide",
    "transition-colors hover:bg-rsi-bg-deep/70",
    "focus-visible:outline-none focus-visible:bg-rsi-bg-deep/70",
  ].join(" ");

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Actions for ${mission.title}`}
        title="Contract actions"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className={[
          "flex size-8 items-center justify-center rounded-rsi border border-rsi-border bg-rsi-surface",
          "text-rsi-text-secondary transition-colors",
          "hover:border-rsi-border-strong hover:text-rsi-text",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
          open ? "border-rsi-accent/50 text-rsi-accent" : "",
        ].join(" ")}
      >
        <EllipsisIcon />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[11.5rem] overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface shadow-rsi-panel"
        >
          <button
            type="button"
            role="menuitem"
            className={[
              itemClass,
              isCompleted ? "text-rsi-success" : "text-rsi-text-secondary",
            ].join(" ")}
            onClick={() => {
              onToggleCompleted(!isCompleted);
              setOpen(false);
            }}
          >
            <CompleteIcon isCompleted={isCompleted} />
            {isCompleted ? "Reopen contract" : "Complete contract"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={[
              itemClass,
              isHidden ? "text-rsi-accent" : "text-rsi-text-secondary",
            ].join(" ")}
            onClick={() => {
              onToggleHidden(!isHidden);
              setOpen(false);
            }}
          >
            <VisibilityIcon isHidden={isHidden} />
            {isHidden ? "Show in route" : "Hide from route"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${itemClass} text-rsi-danger`}
            onClick={() => {
              onRemoveMission();
              setOpen(false);
            }}
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
            Delete from session
          </button>
        </div>
      ) : null}
    </div>
  );
}

function resolvedBoxSplits(mission: SessionMission): ScuBoxSplits {
  const aggregate = cargoBoxSplits.selectedAggregate(mission);
  const hasBoxes =
    aggregate.scuOne +
      aggregate.scuTwo +
      aggregate.scuFour +
      aggregate.scuEight +
      aggregate.scuSixteen +
      aggregate.scuThirtyTwo >
    0;
  if (hasBoxes) return aggregate;
  return scuBoxSplitsForScu(
    missionTotalScu(mission),
    mission.scuMaxContainerSize,
  );
}

function missionBoxCount(mission: SessionMission): number {
  const ready = cargoBoxSplits.withDefaults(mission);
  const lines = cargoBoxSplits.commodityLines(ready);
  if (lines.length === 0) {
    return boxCountsFromBreakdown(resolvedBoxSplits(mission)).reduce(
      (sum, entry) => sum + entry.count,
      0,
    );
  }
  return lines.reduce((sum, line) => {
    const splits =
      ready.scuCargoBoxSplits?.[line.commoditySlug] ??
      resolvedBoxSplits(mission);
    return (
      sum +
      boxCountsFromBreakdown(splits).reduce(
        (lineSum, entry) => lineSum + entry.count,
        0,
      )
    );
  }, 0);
}

type MissionContractViewModel = {
  isHidden: boolean;
  isCompleted: boolean;
  rank: MissionRank | null;
  title: string;
  totalScu: number;
  reward: string;
  exp: number | null;
  cargoBoxLines: Array<{
    commoditySlug: string;
    commodity: string;
    scu: number;
  }>;
  readyBoxes: ReturnType<typeof cargoBoxSplits.withDefaults>;
  fromLocations: CatalogLocationBadgeItem[];
  toLocations: CatalogLocationBadgeItem[];
  statusBadge: ReactNode;
};

type MissionContractHandlers = {
  onToggleHidden: (missionId: string, isHidden: boolean) => void;
  onToggleCompleted: (missionId: string, isCompleted: boolean) => void;
  onRemoveMission: (missionId: string) => void;
  onEditBoxTypes: (missionId: string) => void;
};

function missionContractView(
  mission: SessionMission,
  rows: HaulingChecklistRow[],
): MissionContractViewModel {
  const isHidden = Boolean(mission.isHidden);
  const isCompleted = Boolean(mission.isCompleted);
  const rank = resolveMissionRank(mission);
  const title = resolveMissionTitle(mission);
  const totalScu = missionTotalScu(mission);
  const readyBoxes = cargoBoxSplits.withDefaults(mission);
  const cargoBoxLines = cargoBoxSplits.commodityLines(readyBoxes);
  const collect = missionCollectObjectives(mission, rows);
  const deliver = missionDeliverObjectives(mission, rows);

  let statusBadge: ReactNode = null;
  if (isCompleted) {
    statusBadge = (
      <span className="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-rsi-success">
        complete
      </span>
    );
  } else if (isHidden) {
    statusBadge = (
      <span className="font-mono text-[0.5rem] uppercase tracking-[0.14em] text-rsi-text-muted">
        hidden
      </span>
    );
  }

  return {
    isHidden,
    isCompleted,
    rank,
    title: title || mission.title,
    totalScu,
    reward: formatRewardCell(mission),
    exp: estimateMissionHaulingRepXp(mission),
    cargoBoxLines,
    readyBoxes,
    fromLocations: collect.map((line) =>
      sessionLocationBadge(
        line.locationLabel,
        isMissionLocationCompleted(
          mission,
          rows,
          line.locationLabel,
          "pickup",
        ),
      ),
    ),
    toLocations: deliver.map((line) =>
      sessionLocationBadge(
        line.locationLabel,
        isMissionLocationCompleted(
          mission,
          rows,
          line.locationLabel,
          "delivery",
        ),
      ),
    ),
    statusBadge,
  };
}

function cargoLinesOrFallback(
  view: MissionContractViewModel,
): MissionContractViewModel["cargoBoxLines"] {
  if (view.cargoBoxLines.length > 0) return view.cargoBoxLines;
  return [
    {
      commoditySlug: "_",
      commodity: "Cargo",
      scu: view.totalScu,
    },
  ];
}

function screenshotUrlForSession(
  logicalPath: string,
  sessionId: string,
): string | null {
  const parts = logicalPath.trim().split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    return screenshotUrlFromLogicalPath(`${sessionId}/${parts[0]}`);
  }
  return screenshotUrlFromLogicalPath(logicalPath);
}

function missionSourceGalleryItems(
  mission: SessionMission,
  sessionId: string | null,
): ImageLightboxItem[] {
  if (!sessionId) return [];
  const caption = `${resolveMissionTitle(mission) || mission.title}\n${missionTotalScu(mission)}SCU`;
  const items: ImageLightboxItem[] = [];
  for (const logicalPath of mission.screenshots ?? []) {
    if (!logicalPath.trim()) continue;
    const url = screenshotUrlForSession(logicalPath, sessionId);
    if (!url) continue;
    const filename =
      logicalPath.split("/").filter(Boolean).at(-1) ?? logicalPath;
    items.push({
      src: url,
      alt: filename,
      title: filename,
      caption,
    });
  }
  return items;
}

function MissionBoxesButton({
  mission,
  view,
  onEditBoxTypes,
  className = "",
}: {
  mission: SessionMission;
  view: MissionContractViewModel;
  onEditBoxTypes: (missionId: string) => void;
  className?: string;
}) {
  const { isCompleted, readyBoxes } = view;
  return (
    <button
      type="button"
      disabled={isCompleted}
      title={
        isCompleted
          ? "Box types locked on completed contracts"
          : "Edit box types"
      }
      aria-label={`Edit box types for ${mission.title}`}
      onClick={(event) => {
        event.stopPropagation();
        onEditBoxTypes(mission.id);
      }}
      className={[
        "inline-flex max-w-full shrink-0 items-center gap-2 rounded-rsi border px-2 py-1",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
        isCompleted
          ? "cursor-not-allowed border-rsi-border/50 opacity-60"
          : "border-rsi-border/80 bg-rsi-surface/60 hover:border-rsi-accent/50 hover:bg-rsi-accent-muted/25",
        className,
      ].join(" ")}
    >
      <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        {cargoLinesOrFallback(view).map((line) => {
          const splits =
            readyBoxes.scuCargoBoxSplits?.[line.commoditySlug] ??
            resolvedBoxSplits(mission);
          const cargoColor =
            resolveCommodityColorHex(null, null, line.commoditySlug) ??
            "var(--rsi-accent)";
          return (
            <span
              key={line.commoditySlug}
              className="inline-flex min-w-0 items-center gap-1.5"
            >
              <span
                className="max-w-[7rem] truncate font-mono text-[0.45rem] uppercase tracking-[0.1em]"
                style={{
                  color: isCompleted ? "var(--rsi-text-muted)" : cargoColor,
                }}
              >
                {line.commodity}
              </span>
              <CargoBoxCountIcons
                boxCounts={boxCountsFromBreakdown(splits)}
                color={isCompleted ? "var(--rsi-text-muted)" : cargoColor}
                className="gap-x-1 [&_svg]:h-3.5 [&_svg]:w-auto [&_span]:text-[0.55rem]"
              />
            </span>
          );
        })}
      </span>
    </button>
  );
}

const MissionContractCard = memo(function MissionContractCard({
  mission,
  rows,
  sessionId = null,
  onToggleHidden,
  onToggleCompleted,
  onRemoveMission,
  onEditBoxTypes,
}: {
  mission: SessionMission;
  rows: HaulingChecklistRow[];
  sessionId?: string | null;
} & MissionContractHandlers) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const galleryItems = useMemo(
    () => missionSourceGalleryItems(mission, sessionId),
    [mission, sessionId],
  );
  const hasSource = galleryItems.length > 0;
  const view = missionContractView(mission, rows);
  const {
    isHidden,
    isCompleted,
    rank,
    title,
    totalScu,
    reward,
    exp,
    fromLocations,
    toLocations,
    statusBadge,
  } = view;

  return (
    <>
      <article
        data-mission-id={mission.id}
        title={
          hasSource
            ? galleryItems.length > 1
              ? `View ${galleryItems.length} source screenshots`
              : "View source screenshot"
            : "No source screenshot on file"
        }
        onClick={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("button, a, [role='menu']")) return;
          if (!hasSource) return;
          setGalleryIndex(0);
          setGalleryOpen(true);
        }}
        className={[
          "[content-visibility:auto] [contain-intrinsic-size:auto_7rem]",
          "flex h-full flex-col rounded-rsi border border-rsi-border/70 px-3 py-2.5",
          // Force default cursor when there is no source to open.
          hasSource ? "cursor-pointer" : "!cursor-default",
          isHidden ? "opacity-55" : "",
          isCompleted
            ? "bg-rsi-success/5"
            : hasSource
              ? "bg-rsi-bg-deep/25 hover:border-rsi-border-strong hover:bg-rsi-bg-deep/40"
              : "bg-rsi-bg-deep/25",
        ].join(" ")}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span
                  className={[
                    "font-mono text-[0.55rem] tracking-[0.08em]",
                    isCompleted ? "text-rsi-text-muted" : "text-rsi-accent",
                  ].join(" ")}
                >
                  {rank ?? "—"}
                </span>
                {statusBadge}
              </div>
              <h3
                className={[
                  "mt-0.5 text-sm font-semibold tracking-wide break-words hyphens-auto",
                  isCompleted
                    ? "text-rsi-text-muted line-through decoration-rsi-success/40"
                    : "text-rsi-text",
                ].join(" ")}
              >
                {title}
              </h3>
              <p className="mt-0.5 font-mono text-[0.6rem] tabular-nums tracking-wide text-rsi-text-secondary">
                {reward === "—" ? "—" : reward}
                {reward !== "—" ? (
                  <span className="ml-0.5 text-[0.5rem] tracking-[0.08em] text-rsi-text-muted">
                    aUEC
                  </span>
                ) : null}
                <span className="text-rsi-text-muted"> · </span>
                <span>
                  {totalScu}
                  <span title="SCU">SCU</span>
                </span>
                <span className="text-rsi-text-muted"> · </span>
                <span
                  title={
                    exp != null
                      ? `Approximate Covalex hauling reputation XP: ${exp.toLocaleString("en-US")}`
                      : "Approximate Covalex hauling reputation XP"
                  }
                >
                  {exp != null ? `${formatHaulingRepXp(exp)} EXP` : "— EXP"}
                </span>
              </p>
            </div>
            <MissionActionsMenu
              mission={mission}
              onToggleCompleted={(isCompletedNext) =>
                onToggleCompleted(mission.id, isCompletedNext)
              }
              onToggleHidden={(isHiddenNext) =>
                onToggleHidden(mission.id, isHiddenNext)
              }
              onRemoveMission={() => onRemoveMission(mission.id)}
            />
          </div>

          <div className="mt-1.5">
            <CargoAmountBadges
              tightScuUnit
              items={cargoLinesOrFallback(view).map((line) => ({
                commoditySlug: line.commoditySlug,
                commodityName: line.commodity,
                scu: line.scu,
                isCompleted,
              }))}
            />
          </div>

          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
            <CatalogLocationBadges items={fromLocations} tone="from" />
            {fromLocations.length > 0 && toLocations.length > 0 ? (
              <span
                aria-hidden
                className="font-mono text-[0.55rem] text-rsi-text-muted"
              >
                →
              </span>
            ) : null}
            <CatalogLocationBadges items={toLocations} tone="to" />
          </div>

          <div className="mt-auto pt-2">
            <MissionBoxesButton
              mission={mission}
              view={view}
              onEditBoxTypes={onEditBoxTypes}
            />
          </div>
        </div>
      </article>
      {galleryOpen && galleryItems.length > 0 ? (
        <ImageLightbox
          src={galleryItems[galleryIndex]?.src ?? galleryItems[0]!.src}
          alt={galleryItems[galleryIndex]?.alt}
          title={galleryItems[galleryIndex]?.title}
          caption={galleryItems[galleryIndex]?.caption}
          items={galleryItems}
          index={galleryIndex}
          onIndexChange={setGalleryIndex}
          onClose={() => setGalleryOpen(false)}
        />
      ) : null}
    </>
  );
});

export function SessionMissionsModal({
  open,
  missions,
  rows = [],
  sessionId = null,
  focusMissionId = null,
  onClose,
  onToggleHidden,
  onToggleCompleted,
  onRemoveMission,
  onSelectBoxBreakdown,
  onSaveMissionScuDraft,
}: SessionMissionsModalProps) {
  const [enriched, setEnriched] = useState<SessionMission[]>(missions);
  const [boxEditMissionId, setBoxEditMissionId] = useState<string | null>(null);
  /** Keep DOM warm after first open so close/reopen is CSS-only. */
  const [retain, setRetain] = useState(false);
  /** Defer heavy card paint one frame so the dialog chrome can appear first. */
  const [paintRows, setPaintRows] = useState(false);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const catalogByIdRef = useRef<Map<string, CatalogMission>>(new Map());
  const catalogIdsKeyRef = useRef<string>("");

  const catalogIdsKey = useMemo(
    () =>
      missions
        .map((mission) => mission.catalogMissionId)
        .filter((id): id is string => Boolean(id))
        .sort()
        .join(","),
    [missions],
  );

  const applyCatalogOverlay = useCallback(
    (nextMissions: SessionMission[]) =>
      nextMissions.map((mission) =>
        enrichSessionMissionFromCatalog(
          mission,
          mission.catalogMissionId
            ? catalogByIdRef.current.get(mission.catalogMissionId)
            : null,
        ),
      ),
    [],
  );

  useEffect(() => {
    if (!open) return;
    setRetain(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && boxEditMissionId == null) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, boxEditMissionId]);

  useEffect(() => {
    if (!open) {
      setBoxEditMissionId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (paintRows) return;
    const frame = window.requestAnimationFrame(() => {
      startTransition(() => setPaintRows(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, paintRows]);

  // Prefetch / refresh catalog overlay even while closed so open is not network-bound.
  useEffect(() => {
    setEnriched(applyCatalogOverlay(missions));

    if (!catalogIdsKey) {
      catalogByIdRef.current = new Map();
      catalogIdsKeyRef.current = "";
      return;
    }

    if (catalogIdsKey === catalogIdsKeyRef.current) return;

    let cancelled = false;
    const ids = catalogIdsKey.split(",");
    void fetchCatalogMissionsByIds(ids)
      .then((catalogRows) => {
        if (cancelled) return;
        catalogByIdRef.current = new Map(
          catalogRows.map((row) => [row.id, row]),
        );
        catalogIdsKeyRef.current = catalogIdsKey;
        setEnriched(applyCatalogOverlay(missions));
      })
      .catch(() => {
        if (!cancelled) setEnriched(missions);
      });

    return () => {
      cancelled = true;
    };
  }, [missions, catalogIdsKey, applyCatalogOverlay]);

  const boxEditMission =
    boxEditMissionId == null
      ? null
      : (enriched.find((mission) => mission.id === boxEditMissionId) ?? null);

  const columnTotals = useMemo(() => {
    let rewardAuec = 0;
    let scu = 0;
    let exp = 0;
    let boxes = 0;
    for (const mission of enriched) {
      rewardAuec += missionAuecAmount(mission);
      scu += missionTotalScu(mission);
      exp += estimateMissionHaulingRepXp(mission) ?? 0;
      boxes += missionBoxCount(mission);
    }
    return { rewardAuec, scu, exp, boxes, stops: rows.length };
  }, [enriched, rows]);

  const handleToggleHidden = useCallback(
    (missionId: string, isHidden: boolean) => {
      onToggleHidden(missionId, isHidden);
    },
    [onToggleHidden],
  );

  const handleToggleCompleted = useCallback(
    (missionId: string, isCompleted: boolean) => {
      onToggleCompleted(missionId, isCompleted);
    },
    [onToggleCompleted],
  );

  const handleRemoveMission = useCallback(
    (missionId: string) => {
      onRemoveMission(missionId);
    },
    [onRemoveMission],
  );

  const handleEditBoxTypes = useCallback((missionId: string) => {
    setBoxEditMissionId(missionId);
  }, []);

  useEffect(() => {
    if (!open || !focusMissionId || !paintRows) return;
    const id = window.requestAnimationFrame(() => {
      const card = listScrollRef.current?.querySelector(
        `[data-mission-id="${CSS.escape(focusMissionId)}"]`,
      );
      if (!(card instanceof HTMLElement)) return;
      card.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, focusMissionId, paintRows, enriched]);

  if (!open && !retain) return null;

  return (
    <div
      className={[
        "fixed inset-0 z-50 flex items-stretch justify-center bg-rsi-bg-deep/85 px-3 pt-14 pb-3 sm:items-center sm:px-4 sm:pt-14 sm:pb-4",
        open ? "" : "hidden",
      ].join(" ")}
      role="dialog"
      aria-modal={open}
      aria-label="Contracts"
      aria-hidden={!open}
      inert={!open ? true : undefined}
      onClick={(event) => {
        if (!open) return;
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative flex h-[calc(100dvh-4.25rem)] w-full max-w-5xl sm:h-auto sm:max-h-[90vh]">
        <ModalCloseButton onClick={onClose} />
        <div className="flex h-full w-full flex-col overflow-hidden border-rsi-border bg-rsi-surface shadow-rsi-panel sm:rounded-rsi sm:border">
        <header className="shrink-0 border-b border-rsi-divider px-4 py-3 sm:px-5">
          <h2 className="min-w-0 text-base font-semibold tracking-wide text-rsi-text">
            <span className="tabular-nums">{enriched.length}</span> Contracts
          </h2>
          {enriched.length > 0 ? (
            <div
              className="mt-2 flex w-fit max-w-full flex-nowrap items-stretch divide-x divide-rsi-border overflow-x-auto overscroll-x-contain rounded-rsi border border-rsi-border bg-rsi-bg-deep/55 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              role="group"
              aria-label="Contract totals"
            >
              <div
                className="flex shrink-0 flex-col justify-center px-2.5 py-1 text-left first:pl-3 sm:min-w-[4.5rem] sm:px-3 sm:py-1.5 sm:first:pl-3.5"
                title="Route stop count"
              >
                <p className="font-mono text-[0.45rem] uppercase leading-none tracking-[0.12em] text-rsi-text-muted sm:text-[0.55rem] sm:tracking-[0.16em]">
                  Stops
                </p>
                <p className="mt-0.5 max-w-full whitespace-nowrap font-mono text-[0.7rem] leading-none tabular-nums tracking-wide text-rsi-text sm:mt-1 sm:text-sm">
                  {columnTotals.stops}
                </p>
              </div>
              <div
                className="flex shrink-0 flex-col justify-center px-2.5 py-1 text-left sm:min-w-[4.5rem] sm:px-3 sm:py-1.5"
                title="Contracts total boxes"
              >
                <p className="font-mono text-[0.45rem] uppercase leading-none tracking-[0.12em] text-rsi-text-muted sm:text-[0.55rem] sm:tracking-[0.16em]">
                  Boxes
                </p>
                <p className="mt-0.5 max-w-full whitespace-nowrap font-mono text-[0.7rem] leading-none tabular-nums tracking-wide text-rsi-text sm:mt-1 sm:text-sm">
                  {columnTotals.boxes}
                </p>
              </div>
              <div
                className="flex shrink-0 flex-col justify-center px-2.5 py-1 text-left sm:min-w-[4.5rem] sm:px-3 sm:py-1.5"
                title="Contracts total SCU"
              >
                <p className="font-mono text-[0.45rem] uppercase leading-none tracking-[0.12em] text-rsi-text-muted sm:text-[0.55rem] sm:tracking-[0.16em]">
                  SCU
                </p>
                <p className="mt-0.5 max-w-full whitespace-nowrap font-mono text-[0.7rem] leading-none tabular-nums tracking-wide text-rsi-text sm:mt-1 sm:text-sm">
                  {columnTotals.scu}
                  <span className="ml-1 text-[0.45rem] tracking-[0.1em] text-rsi-text-muted sm:text-[0.5rem] sm:tracking-[0.12em]">
                    scu
                  </span>
                </p>
              </div>
              <div
                className="flex shrink-0 flex-col justify-center px-2.5 py-1 text-left sm:min-w-[4.5rem] sm:px-3 sm:py-1.5"
                title="Contracts total aUEC"
              >
                <p className="font-mono text-[0.45rem] uppercase leading-none tracking-[0.12em] text-rsi-text-muted sm:text-[0.55rem] sm:tracking-[0.16em]">
                  aUEC
                </p>
                <p className="mt-0.5 max-w-full whitespace-nowrap font-mono text-[0.7rem] leading-none tabular-nums tracking-wide text-rsi-text sm:mt-1 sm:text-sm">
                  {columnTotals.rewardAuec > 0
                    ? Math.floor(columnTotals.rewardAuec).toLocaleString(
                        "en-US",
                      )
                    : "—"}
                </p>
              </div>
              <div
                className="flex shrink-0 flex-col justify-center px-2.5 py-1 text-left last:pr-3 sm:min-w-[4.5rem] sm:px-3 sm:py-1.5 sm:last:pr-3.5"
                title={`Contracts total approximate hauling XP: ${columnTotals.exp.toLocaleString("en-US")}`}
              >
                <p className="font-mono text-[0.45rem] uppercase leading-none tracking-[0.12em] text-rsi-text-muted sm:text-[0.55rem] sm:tracking-[0.16em]">
                  XP
                </p>
                <p className="mt-0.5 max-w-full whitespace-nowrap font-mono text-[0.7rem] leading-none tabular-nums tracking-wide text-rsi-text sm:mt-1 sm:text-sm">
                  {columnTotals.exp > 0
                    ? formatHaulingRepXp(columnTotals.exp)
                    : "—"}
                </p>
              </div>
            </div>
          ) : null}
        </header>

        <div
          ref={listScrollRef}
          className="min-h-0 flex-1 overflow-auto overscroll-contain"
        >
          {enriched.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-rsi-text-muted sm:px-5">
              No contracts in this session.
            </p>
          ) : !paintRows ? (
            <SessionAcceptedContractsSkeleton
              rows={Math.min(Math.max(enriched.length, 3), 8)}
            />
          ) : (
            <div className="grid grid-cols-1 gap-2 p-3 pb-4 sm:grid-cols-2 sm:px-4 sm:pb-5">
              {enriched.map((mission) => (
                <MissionContractCard
                  key={mission.id}
                  mission={mission}
                  rows={rows}
                  sessionId={sessionId}
                  onToggleHidden={handleToggleHidden}
                  onToggleCompleted={handleToggleCompleted}
                  onRemoveMission={handleRemoveMission}
                  onEditBoxTypes={handleEditBoxTypes}
                />
              ))}
            </div>
          )}
        </div>
        </div>
      </div>

      {open && boxEditMission ? (
        <StopMissionBoxConfigModal
          {...stopMissionBoxConfigModalProps({
            mission: boxEditMission,
            rows,
            sessionId,
            onClose: () => setBoxEditMissionId(null),
            onSelectBoxBreakdown,
            onSaveMissionScuDraft,
          })}
        />
      ) : null}
    </div>
  );
}
