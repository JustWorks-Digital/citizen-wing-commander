"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogMission } from "@/db/schema";
import { fetchCatalogMissions } from "@/lib/api/catalogMissionsApi";
import { searchCatalogMissions } from "@/lib/missions/searchCatalogMissions";
import {
  filterAndSortCatalogMissions,
  type CatalogTableFilters,
  type CatalogTableSort,
} from "@/lib/missions/catalogMissionTableQuery";
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";
import {
  ImageLightbox,
  type ImageLightboxItem,
} from "@/components/ui/ImageLightbox";
import { MissionCatalogDetail } from "./MissionCatalogDetail";
import { MissionCatalogFilters } from "./MissionCatalogFilters";
import { MissionCatalogJsonModal } from "./MissionCatalogJsonModal";
import { MissionCatalogTable } from "./MissionCatalogTable";

export type MissionsCatalogViewProps = {
  /** Optional initial rows (Storybook / SSR). When omitted, loads from API. */
  initialMissions?: CatalogMission[];
};

export function MissionsCatalogView({
  initialMissions,
}: MissionsCatalogViewProps) {
  const [missions, setMissions] = useState<CatalogMission[]>(
    initialMissions ?? [],
  );
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<CatalogTableFilters>({});
  const [sort, setSort] = useState<CatalogTableSort>(null); // table header sort only
  const [isLoading, setIsLoading] = useState(!initialMissions);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogMission | null>(null);
  const [jsonMission, setJsonMission] = useState<CatalogMission | null>(null);
  const [lightbox, setLightbox] = useState<ImageLightboxItem | null>(null);

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
            err instanceof Error ? err.message : "Failed to load missions",
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

  const openSource = (mission: CatalogMission) => {
    const url = screenshotUrlFromLogicalPath(mission.latestScreenshotPath);
    if (!url) return;
    const filename =
      mission.latestScreenshotPath?.split("/").filter(Boolean).at(-1) ??
      "source";
    setLightbox({
      src: url,
      alt: filename,
      title: `${mission.title} · ${filename}`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-rsi-accent">
          Planning
        </p>
        <h2 className="text-xl font-semibold tracking-wide text-rsi-text sm:text-2xl">
          Missions catalog
        </h2>
      </div>

      {error ? <p className="text-sm text-rsi-warn">{error}</p> : null}

      {isLoading ? (
        <p className="font-mono text-sm text-rsi-text-muted">Loading missions…</p>
      ) : missions.length === 0 ? (
        <p className="text-sm text-rsi-text-muted">No catalog missions yet.</p>
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
          {visible.length === 0 ? (
            <p className="text-sm text-rsi-text-muted">
              No missions match these filters.
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
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  );
}
