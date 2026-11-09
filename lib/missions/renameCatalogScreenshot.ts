import { access, copyFile, readdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  deleteCatalogMissionsByIds,
  getCatalogMission,
  listCatalogMissions,
  updateCatalogMissionScreenshotPath,
} from "@/db/queries/catalogMissions";
import { rewriteScreenshotLogicalPathInSessions } from "@/db/queries/deliverySessions";
import { catalogMissions } from "@/db/schema";
import type { HaulingCatalogMissionPayload } from "@/lib/missions/catalogMission";
import { buildCatalogScreenshotFilenameFromPayload } from "@/lib/missions/catalogScreenshotFilename";
import {
  absoluteScreenshotPath,
  screenshotLogicalPath,
} from "@/lib/sessions/screenshotStore";

function isHaulingPayload(
  payload: unknown,
): payload is HaulingCatalogMissionPayload {
  return (
    typeof payload === "object" &&
    payload != null &&
    (payload as { kind?: string }).kind === "hauling"
  );
}

function replaceLogicalPath(
  value: string | null | undefined,
  from: string,
  to: string,
): string | null | undefined {
  if (!value) return value;
  return value === from ? to : value;
}

async function countMissionsUsingPath(logicalPath: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      n: sql<number>`count(*)::int`,
    })
    .from(catalogMissions)
    .where(eq(catalogMissions.latestScreenshotPath, logicalPath));
  return Number(row?.n ?? 0);
}

async function fileExists(absolute: string): Promise<boolean> {
  try {
    await access(absolute);
    return true;
  } catch {
    return false;
  }
}

/** Find an already-renamed file in the batch whose name embeds this mission id. */
async function findExistingNamedFile(
  batchId: string,
  missionId: string,
): Promise<string | null> {
  const id8 = missionId.replace(/-/g, "").slice(0, 8);
  const dir = path.dirname(absoluteScreenshotPath(`${batchId}/_.png`));
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return null;
  }
  const hit = names.find(
    (name) => name.includes(`_${id8}_`) && !name.startsWith("image-2026"),
  );
  return hit ? screenshotLogicalPath(batchId, hit) : null;
}

/**
 * Rename a catalog mission's source screenshot on disk to the descriptive
 * contract naming convention, and update `latestScreenshotPath` / payload refs
 * **by mission id** (never fingerprint upsert — that creates duplicates).
 *
 * When multiple missions share the same file, copies instead of renaming so
 * sibling refs stay valid.
 */
export async function renameCatalogMissionScreenshot(
  missionId: string,
): Promise<{
  missionId: string;
  oldLogicalPath: string;
  newLogicalPath: string;
  filename: string;
  renamed: boolean;
  copied: boolean;
  relinked: boolean;
}> {
  const mission = await getCatalogMission(missionId);
  if (!mission) {
    throw new Error(`Catalog mission not found: ${missionId}`);
  }
  if (!isHaulingPayload(mission.payload)) {
    throw new Error(`Mission ${missionId} is not a hauling catalog payload`);
  }

  const oldLogicalPath = mission.latestScreenshotPath?.trim();
  if (!oldLogicalPath) {
    throw new Error(`Mission ${missionId} has no latestScreenshotPath`);
  }

  const ext = path.extname(oldLogicalPath) || ".png";
  const batchId = oldLogicalPath.split("/").filter(Boolean)[0]!;
  const filename = buildCatalogScreenshotFilenameFromPayload(mission.payload, {
    missionId: mission.id,
    extension: ext,
  });
  let newLogicalPath = screenshotLogicalPath(batchId, filename);
  const oldAbsolute = absoluteScreenshotPath(oldLogicalPath);
  let newAbsolute = absoluteScreenshotPath(newLogicalPath);

  let renamed = false;
  let copied = false;
  let relinked = false;

  if (oldLogicalPath === newLogicalPath) {
    return {
      missionId: mission.id,
      oldLogicalPath,
      newLogicalPath,
      filename,
      renamed: false,
      copied: false,
      relinked: false,
    };
  }

  const oldExists = await fileExists(oldAbsolute);
  const newExists = await fileExists(newAbsolute);

  if (!oldExists) {
    const recovered = await findExistingNamedFile(batchId, mission.id);
    if (recovered) {
      newLogicalPath = recovered;
      newAbsolute = absoluteScreenshotPath(newLogicalPath);
      relinked = true;
    } else if (!newExists) {
      throw new Error(
        `Screenshot missing on disk for ${missionId}: ${oldLogicalPath}`,
      );
    } else {
      relinked = true;
    }
  } else if (!newExists) {
    const sharedCount = await countMissionsUsingPath(oldLogicalPath);
    if (sharedCount > 1) {
      await copyFile(oldAbsolute, newAbsolute);
      copied = true;
    } else {
      await rename(oldAbsolute, newAbsolute);
      renamed = true;
    }
  } else if (oldExists && newExists && oldAbsolute !== newAbsolute) {
    // Target already present from a prior run — drop orphaned old name if exclusive.
    const sharedCount = await countMissionsUsingPath(oldLogicalPath);
    if (sharedCount <= 1) {
      await unlink(oldAbsolute);
    }
    relinked = true;
  }

  const payload: HaulingCatalogMissionPayload = {
    ...mission.payload,
    latestScreenshotPath: newLogicalPath,
  };
  const extras = { ...(payload.extras ?? {}) };
  const alts = extras.alternateScreenshots;
  if (Array.isArray(alts)) {
    extras.alternateScreenshots = alts.map((entry) => {
      if (typeof entry === "string") {
        return replaceLogicalPath(entry, oldLogicalPath, newLogicalPath);
      }
      if (entry && typeof entry === "object") {
        const row = entry as Record<string, unknown>;
        const pathValue =
          typeof row.path === "string"
            ? row.path
            : typeof row.logicalPath === "string"
              ? row.logicalPath
              : null;
        if (pathValue === oldLogicalPath) {
          return { ...row, path: newLogicalPath, logicalPath: newLogicalPath };
        }
      }
      return entry;
    });
    payload.extras = extras;
  }

  await updateCatalogMissionScreenshotPath({
    missionId: mission.id,
    latestScreenshotPath: newLogicalPath,
    payload,
  });

  // Keep live checklist mission.screenshots in sync with the renamed file.
  await rewriteScreenshotLogicalPathInSessions(oldLogicalPath, newLogicalPath);

  return {
    missionId: mission.id,
    oldLogicalPath,
    newLogicalPath,
    filename: path.basename(newLogicalPath),
    renamed,
    copied,
    relinked,
  };
}

/**
 * Remove fingerprint-upsert duplicates created by an earlier rename bug:
 * rows whose screenshot filename embeds a *different* mission id prefix.
 */
export async function deleteDuplicateCatalogScreenshotMissions(): Promise<{
  deleted: number;
  ids: string[];
}> {
  const missions = await listCatalogMissions({ limit: 500 });
  const ids: string[] = [];
  for (const mission of missions) {
    const logical = mission.latestScreenshotPath?.trim();
    if (!logical) continue;
    const base = logical.split("/").filter(Boolean).at(-1) ?? "";
    if (!base.includes("scu") || !base.includes("_to_")) continue;
    const id8 = mission.id.replace(/-/g, "").slice(0, 8);
    if (!base.includes(`_${id8}_`)) {
      ids.push(mission.id);
    }
  }
  const deleted = await deleteCatalogMissionsByIds(ids);
  return { deleted, ids };
}

/** Rename every catalog mission screenshot that has a `latestScreenshotPath`. */
export async function renameAllCatalogMissionScreenshots(options?: {
  limit?: number;
  dryRun?: boolean;
  cleanupDuplicates?: boolean;
}): Promise<{
  total: number;
  changed: number;
  skipped: number;
  duplicatesDeleted: number;
  errors: Array<{ missionId: string; error: string }>;
  results: Array<{
    missionId: string;
    oldLogicalPath: string;
    newLogicalPath: string;
    renamed: boolean;
    copied: boolean;
    relinked?: boolean;
  }>;
}> {
  let duplicatesDeleted = 0;
  if (options?.cleanupDuplicates && !options.dryRun) {
    const cleaned = await deleteDuplicateCatalogScreenshotMissions();
    duplicatesDeleted = cleaned.deleted;
  }

  const missions = await listCatalogMissions({
    limit: options?.limit ?? 500,
  });
  const withShots = missions.filter((m) => m.latestScreenshotPath?.trim());
  const results: Array<{
    missionId: string;
    oldLogicalPath: string;
    newLogicalPath: string;
    renamed: boolean;
    copied: boolean;
    relinked?: boolean;
  }> = [];
  const errors: Array<{ missionId: string; error: string }> = [];
  let skipped = 0;

  for (const mission of withShots) {
    try {
      if (options?.dryRun) {
        if (!isHaulingPayload(mission.payload) || !mission.latestScreenshotPath) {
          skipped += 1;
          continue;
        }
        const ext = path.extname(mission.latestScreenshotPath) || ".png";
        const batchId = mission.latestScreenshotPath.split("/").filter(Boolean)[0]!;
        const filename = buildCatalogScreenshotFilenameFromPayload(
          mission.payload,
          { missionId: mission.id, extension: ext },
        );
        const newLogicalPath = screenshotLogicalPath(batchId, filename);
        if (newLogicalPath === mission.latestScreenshotPath) {
          skipped += 1;
          continue;
        }
        results.push({
          missionId: mission.id,
          oldLogicalPath: mission.latestScreenshotPath,
          newLogicalPath,
          renamed: false,
          copied: false,
        });
        continue;
      }

      const result = await renameCatalogMissionScreenshot(mission.id);
      if (!result.renamed && !result.copied && !result.relinked) {
        skipped += 1;
      } else {
        results.push({
          missionId: result.missionId,
          oldLogicalPath: result.oldLogicalPath,
          newLogicalPath: result.newLogicalPath,
          renamed: result.renamed,
          copied: result.copied,
          relinked: result.relinked,
        });
      }
    } catch (error) {
      errors.push({
        missionId: mission.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    total: withShots.length,
    changed: results.length,
    skipped,
    duplicatesDeleted,
    errors,
    results,
  };
}
