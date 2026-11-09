"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogMission } from "@/db/schema";
import { fetchCatalogMissions } from "@/lib/api/catalogMissionsApi";
import { searchCatalogMissions } from "@/lib/missions/searchCatalogMissions";
import { screenshotUrlFromLogicalPath } from "@/lib/missions/catalogScreenshotUrl";
import {
  ImageLightbox,
  type ImageLightboxItem,
} from "@/components/ui/ImageLightbox";
import { MissionCatalogCard } from "./MissionCatalogCard";
import { MissionCatalogDetail } from "./MissionCatalogDetail";

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
  const [isLoading, setIsLoading] = useState(!initialMissions);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogMission | null>(null);
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
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !lightbox) setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, lightbox]);

  const filtered = useMemo(
    () => searchCatalogMissions(missions, query),
    [missions, query],
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-rsi-accent">
            Planning
          </p>
          <h2 className="text-xl font-semibold tracking-wide text-rsi-text sm:text-2xl">
            Missions catalog
          </h2>
          <p className="mt-1 text-sm text-rsi-text-muted">
            Observed contracts stored for planning — not the live checklist.
          </p>
        </div>
        <label className="block w-full sm:max-w-sm">
          <span className="mb-1 block font-mono text-[0.65rem] uppercase tracking-[0.18em] text-rsi-text-muted">
            Search
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title, location, cargo, contractor…"
            className={[
              "w-full rounded-rsi border border-rsi-border bg-rsi-bg-deep/60 px-3 py-2",
              "text-sm text-rsi-text placeholder:text-rsi-text-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
            ].join(" ")}
          />
        </label>
      </div>

      {error ? <p className="text-sm text-rsi-warn">{error}</p> : null}

      {isLoading ? (
        <p className="font-mono text-sm text-rsi-text-muted">Loading missions…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-rsi-text-muted">
          {missions.length === 0
            ? "No catalog missions yet."
            : "No missions match that search."}
        </p>
      ) : (
        <>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-muted">
            {filtered.length} mission{filtered.length === 1 ? "" : "s"}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((mission) => (
              <MissionCatalogCard
                key={mission.id}
                mission={mission}
                isSelected={selected?.id === mission.id}
                onSelect={setSelected}
                onViewSource={openSource}
              />
            ))}
          </div>
        </>
      )}

      {selected ? (
        <MissionCatalogDetail
          mission={selected}
          onClose={() => setSelected(null)}
          onViewSource={openSource}
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
