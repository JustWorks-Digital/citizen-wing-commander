/**
 * Shared image pick / paste / drop helpers for contract screenshot uploads
 * (session Sources modal and Intake page).
 */

export const IMAGE_UPLOAD_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function imageFilesFromList(list: FileList | File[] | null): File[] {
  if (!list) return [];
  return Array.from(list).filter(
    (file) =>
      IMAGE_UPLOAD_TYPES.has(file.type.toLowerCase()) ||
      /\.(png|jpe?g|webp|gif)$/i.test(file.name),
  );
}

export function imageFilesFromDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fromItems: File[] = [];
  const seen = new Set<string>();

  for (const item of Array.from(data.items)) {
    if (item.kind !== "file") continue;
    const type = item.type.toLowerCase();
    if (!IMAGE_UPLOAD_TYPES.has(type)) continue;
    const file = item.getAsFile();
    if (!file || file.size === 0) continue;
    const fingerprint = `${file.size}:${type}:${file.name}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    const ext = IMAGE_EXT_BY_MIME[type] ?? ".png";
    const index = fromItems.length + 1;
    const name =
      file.name && file.name !== "image.png"
        ? file.name
        : `paste-${stamp}-${index}${ext}`;
    fromItems.push(
      new File([file], name, {
        type: file.type || type,
        lastModified: file.lastModified,
      }),
    );
  }

  if (fromItems.length) return fromItems;
  return imageFilesFromList(data.files);
}

export async function imageFilesFromClipboardApi(): Promise<File[]> {
  if (!navigator.clipboard?.read) return [];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const items = await navigator.clipboard.read();
  const files: File[] = [];
  let index = 0;
  for (const item of items) {
    for (const type of item.types) {
      const mime = type.toLowerCase();
      if (!IMAGE_UPLOAD_TYPES.has(mime)) continue;
      const blob = await item.getType(type);
      if (!blob || blob.size === 0) continue;
      index += 1;
      const ext = IMAGE_EXT_BY_MIME[mime] ?? ".png";
      files.push(
        new File([blob], `paste-${stamp}-${index}${ext}`, {
          type: blob.type || mime,
          lastModified: Date.now(),
        }),
      );
    }
  }
  return files;
}
