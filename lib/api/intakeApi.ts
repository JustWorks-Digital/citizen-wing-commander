import { appApi } from "@/lib/api/appRoutes";
import type { IntakeUploadStatus } from "@/lib/sessions/intakeUploadStore";

export type IntakeUploadListItem = {
  status: IntakeUploadStatus;
  logicalPath: string;
  filename: string;
  bytes: number;
  mtime: string;
  url: string;
};

export type IntakeUploadListResponse = {
  status: IntakeUploadStatus | "all";
  count: number;
  uploads: IntakeUploadListItem[];
};

export type IntakeUploadResponse = {
  ok: true;
  count: number;
  uploads: IntakeUploadListItem[];
};

/** List intake uploads (default: pending inbox). */
export async function fetchIntakeUploads(
  status: IntakeUploadStatus | "all" = "pending",
): Promise<IntakeUploadListResponse> {
  const url = `${appApi.intakeUploads}?status=${encodeURIComponent(status)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Intake list failed (${res.status})`);
  }
  return (await res.json()) as IntakeUploadListResponse;
}

/** Upload one or more contract/mission images into the pending inbox. */
export async function uploadIntakeFiles(
  files: File[],
): Promise<IntakeUploadResponse> {
  if (!files.length) {
    throw new Error("No files to upload");
  }
  const body = new FormData();
  for (const file of files) {
    body.append("file", file, file.name || "paste.png");
  }
  const res = await fetch(appApi.intakeUploads, {
    method: "POST",
    body,
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error || `Intake upload failed (${res.status})`);
  }
  return (await res.json()) as IntakeUploadResponse;
}

/** Remove a pending (or processed) intake image. */
export async function deleteIntakeFile(
  filename: string,
  status: IntakeUploadStatus = "pending",
): Promise<void> {
  const res = await fetch(
    `${appApi.intakeUpload(filename)}?status=${encodeURIComponent(status)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    throw new Error(`Intake delete failed (${res.status})`);
  }
}

/** Mark a pending intake image as processed (moves to processed batch). */
export async function markIntakeFileProcessed(
  filename: string,
): Promise<{ toLogicalPath: string }> {
  const res = await fetch(appApi.intakeUploadProcessed(filename), {
    method: "POST",
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      payload?.error || `Mark processed failed (${res.status})`,
    );
  }
  return (await res.json()) as { toLogicalPath: string };
}
