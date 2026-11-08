import commodityIconsManifest from "@/lib/fixtures/commodityIcons.json";

type CommodityIconsManifest = {
  publicPath: string;
  defaultIcon: string;
  bySlug: Record<string, string>;
};

const manifest = commodityIconsManifest as CommodityIconsManifest;

/** Public URL for a commodity’s wiki inventory icon (kind/default fallback). */
export function getCommodityIconSrc(
  commoditySlug: string | null | undefined,
): string {
  const file =
    (commoditySlug && manifest.bySlug[commoditySlug]) ||
    manifest.defaultIcon;
  return `${manifest.publicPath}/${file}`;
}
