import locationImagesManifest from "@/lib/fixtures/locationImages.json";

type LocationImagesManifest = {
  publicPath: string;
  bySlug: Record<string, string>;
};

const manifest = locationImagesManifest as LocationImagesManifest;

/**
 * Public URL for a location’s wiki photo, or null when no fixture image exists.
 */
export function getLocationImageSrc(
  locationSlug: string | null | undefined,
): string | null {
  if (!locationSlug) return null;
  const file = manifest.bySlug[locationSlug];
  if (!file) return null;
  return `${manifest.publicPath}/${file}`;
}
