"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CatalogMission } from "@/db/schema";
import {
  addCatalogMissionsToSession,
  fetchCatalogMissions,
  type AddCatalogMissionsToSessionResult,
} from "@/lib/api/catalogMissionsApi";
import { searchCatalogMissions } from "@/lib/missions/searchCatalogMissions";
import {
  filterAndSortCatalogMissions,
  type CatalogTableFilters,
  type CatalogTableSort,
} from "@/lib/missions/catalogMissionTableQuery";
import {
  buildCatalogMissionSearchParams,
  catalogMissionSearchParamsEqual,
  parseCatalogMissionUrlState,
} from "@/lib/missions/catalogMissionUrlState";
import {
  catalogCargoIdentitySummary,
  catalogPayload,
  catalogRewardLabel,
  catalogSourceScreenshotCaption,
} from "@/lib/missions/catalogMissionDisplay";
import { auecFromRewards } from "@/lib/missions/catalogMission";
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";
import {
  ImageLightbox,
  type ImageLightboxItem,
} from "@/components/ui/ImageLightbox";
import { Button } from "@/components/ui/Button";
import { AddCatalogMissionsToSessionModal } from "./AddCatalogMissionsToSessionModal";
import { MissionCatalogDetail } from "./MissionCatalogDetail";
import { MissionCatalogFilters } from "./MissionCatalogFilters";
import { MissionCatalogJsonModal } from "./MissionCatalogJsonModal";
import { MissionCatalogSkeleton } from "./MissionCatalogSkeleton";
import { MissionCatalogTable } from "./MissionCatalogTable";

export type MissionsCatalogViewProps = {
  /** Optional initial rows (Storybook / SSR). When omitted, loads from API. */
  initialMissions?: CatalogMission[];
  /** When false, skip URL sync (Storybook / session embed). Default true. */
  persistUrlState?: boolean;
  /** When set, Add applies directly to this session (no picker modal). */
  targetSessionId?: string;
  /** Hide the page heading when embedded in a modal. Default true. */
  showHeading?: boolean;
  onAdded?: (result: AddCatalogMissionsToSessionResult) => void;
};

export function MissionsCatalogView({
  initialMissions,
  persistUrlState = true,
  targetSessionId,
  showHeading = true,
  onAdded,
}: MissionsCatalogViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlState = useMemo(
    () =>
      persistUrlState
        ? parseCatalogMissionUrlState(searchParams)
        : { query: "", filters: {}, sort: null },
    [persistUrlState, searchParams],
  );

  const [missions, setMissions] = useState<CatalogMission[]>(
    initialMissions ?? [],
  );
  const [query, setQuery] = useState(urlState.query);
  const [filters, setFilters] = useState<CatalogTableFilters>(urlState.filters);
  const [sort, setSort] = useState<CatalogTableSort>(urlState.sort);
  const [isLoading, setIsLoading] = useState(!initialMissions);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogMission | null>(null);
  const [jsonMission, setJsonMission] = useState<CatalogMission | null>(null);
  const [lightbox, setLightbox] = useState<ImageLightboxItem | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [isAddToSessionOpen, setIsAddToSessionOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addStatus, setAddStatus] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const applyAddResult = (result: AddCatalogMissionsToSessionResult) => {
    setCheckedIds([]);
    setAddError(null);
    setAddStatus(
      `Added ${result.added} to “${result.sessionName}”` +
        (result.skipped ? ` (${result.skipped} already on session)` : ""),
    );
    window.setTimeout(() => setAddStatus(null), 4000);
    onAdded?.(result);
  };

  const addToTargetSession = async () => {
    if (!targetSessionId || checkedIds.length === 0 || isAdding) return;
    setIsAdding(true);
    setAddError(null);
    try {
      const result = await addCatalogMissionsToSession({
        catalogMissionIds: checkedIds,
        sessionId: targetSessionId,
      });
      applyAddResult(result);
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : "Failed to add contracts",
      );
    } finally {
      setIsAdding(false);
    }
  };

  // Keep React state aligned when the URL changes (back/forward / shared links).
  useEffect(() => {
    if (!persistUrlState) return;
    setQuery(urlState.query);
    setFilters(urlState.filters);
    setSort(urlState.sort);
  }, [persistUrlState, urlState]);

  // Write state back to the URL (shareable + refresh-safe).
  useEffect(() => {
    if (!persistUrlState) return;
    const next = buildCatalogMissionSearchParams({ query, filters, sort });
    if (catalogMissionSearchParamsEqual(next, searchParams)) return;
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    persistUrlState,
    query,
    filters,
    sort,
    pathname,
    router,
    searchParams,
  ]);

  useEffect(() => {
    if (initialMissions) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchCatalogMissions({ limit: 200 });
        if (!cancelled) {
          setMissions(rows);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load contracts",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialMissions]);

  useEffect(() => {
    if (!selected && !jsonMission) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || lightbox) return;
      if (jsonMission) {
        setJsonMission(null);
        return;
      }
      setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, jsonMission, lightbox]);

  const searched = useMemo(
    () => searchCatalogMissions(missions, query),
    [missions, query],
  );

  const visible = useMemo(
    () => filterAndSortCatalogMissions(searched, filters, sort),
    [searched, filters, sort],
  );

  const checkedMissions = useMemo(() => {
    const byId = new Map(missions.map((mission) => [mission.id, mission]));
    return checkedIds.flatMap((id) => {
      const mission = byId.get(id);
      return mission ? [mission] : [];
    });
  }, [missions, checkedIds]);

  const openSource = (mission: CatalogMission) => {
    const url = screenshotUrlFromLogicalPath(mission.latestScreenshotPath);
    if (!url) return;
    const filename =
      mission.latestScreenshotPath?.split("/").filter(Boolean).at(-1) ??
      "source";
    setLightbox({
      src: url,
      alt: filename,
      title: filename,
      caption: catalogSourceScreenshotCaption(mission),
    });
  };

  return (
    <div className="space-y-6">
      {showHeading ? (
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-rsi-accent">
            Planning
          </p>
          <h2 className="text-xl font-semibold tracking-wide text-rsi-text sm:text-2xl">
            Contracts catalog
          </h2>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rsi-warn">{error}</p> : null}

      {isLoading ? (
        <MissionCatalogSkeleton />
      ) : missions.length === 0 ? (
        <p className="text-sm text-rsi-text-muted">No catalog contracts yet.</p>
      ) : (
        <>
          <MissionCatalogFilters
            missions={missions}
            query={query}
            onQueryChange={setQuery}
            filters={filters}
            onFiltersChange={setFilters}
            resultCount={visible.length}
            totalCount={missions.length}
          />
          {checkedMissions.length > 0 ? (
            <div className="space-y-2 rounded-rsi border border-rsi-border bg-rsi-surface/80 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-rsi-text-muted">
                  {checkedMissions.length} selected
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    className="px-3 py-1.5 text-[0.7rem]"
                    onClick={() => setCheckedIds([])}
                  >
                    Clear
                  </Button>
                  <Button
                    variant="primary"
                    className="px-3 py-1.5 text-[0.7rem]"
                    disabled={isAdding}
                    onClick={() => {
                      if (targetSessionId) {
                        void addToTargetSession();
                        return;
                      }
                      setIsAddToSessionOpen(true);
                    }}
                  >
                    {isAdding ? "Adding…" : "Add to session"}
                  </Button>
                </div>
              </div>
              <ul
                aria-label="Selected contracts"
                className="flex flex-wrap gap-1.5"
              >
                {checkedMissions.map((mission) => {
                  const rewards =
                    mission.rewards?.length
                      ? mission.rewards
                      : catalogPayload(mission)?.rewards ?? [];
                  const auecReward =
                    auecFromRewards(rewards) > 0
                      ? catalogRewardLabel(mission)
                      : null;
                  return (
                  <li
                    key={mission.id}
                    className="inline-flex max-w-full items-start gap-1.5 rounded-rsi border border-rsi-border/80 bg-rsi-bg-deep/40 py-1 pl-2 pr-1"
                  >
                    <div className="min-w-0 max-w-[18rem]">
                      <p className="truncate text-xs font-semibold tracking-wide text-rsi-text">
                        {mission.title}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[0.55rem] uppercase tracking-[0.12em] text-rsi-text-muted">
                        {[mission.rank, auecReward]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                      <p className="mt-0.5 truncate text-[0.65rem] leading-snug text-rsi-text-secondary">
                        {catalogCargoIdentitySummary(mission)}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${mission.title}`}
                      title="Remove"
                      onClick={() =>
                        setCheckedIds((ids) =>
                          ids.filter((id) => id !== mission.id),
                        )
                      }
                      className={[
                        "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-rsi-text-muted transition-colors",
                        "hover:bg-rsi-danger-muted hover:text-rsi-danger",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--rsi-ring)] focus-visible:text-rsi-danger",
                      ].join(" ")}
                    >
                      <svg
                        aria-hidden
                        viewBox="0 0 16 16"
                        className="size-2.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      >
                        <path d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </button>
                  </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {addError ? <p className="text-sm text-rsi-warn">{addError}</p> : null}
          {addStatus ? (
            <p className="text-sm text-rsi-accent">{addStatus}</p>
          ) : null}
          {visible.length === 0 ? (
            <p className="text-sm text-rsi-text-muted">
              No contracts match these filters.
            </p>
          ) : (
            <MissionCatalogTable
              missions={visible}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              onViewSource={openSource}
              onViewObject={setJsonMission}
              sort={sort}
              onSortChange={setSort}
              checkedIds={checkedIds}
              onCheckedIdsChange={setCheckedIds}
            />
          )}
        </>
      )}

      {selected ? (
        <MissionCatalogDetail
          mission={selected}
          onClose={() => setSelected(null)}
          onViewSource={openSource}
        />
      ) : null}

      {jsonMission ? (
        <MissionCatalogJsonModal
          mission={jsonMission}
          onClose={() => setJsonMission(null)}
        />
      ) : null}

      {lightbox ? (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          title={lightbox.title}
          caption={lightbox.caption}
          onClose={() => setLightbox(null)}
        />
      ) : null}

      {isAddToSessionOpen && !targetSessionId ? (
        <AddCatalogMissionsToSessionModal
          catalogMissionIds={checkedIds}
          onClose={() => setIsAddToSessionOpen(false)}
          onAdded={applyAddResult}
        />
      ) : null}
    </div>
  );
}
