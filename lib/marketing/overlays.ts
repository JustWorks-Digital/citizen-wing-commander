import overlaysJson from "@/lib/marketing/overlays.json";

export type MarketingOverlayFamily = "landscape" | "square" | "banner";

export type MarketingOverlaySlide = {
  id: string;
  family: MarketingOverlayFamily;
  file: string;
  title: string;
  caption: string;
  width: number;
  height: number;
  ratio: string;
};

export type MarketingOverlayFamilyMeta = {
  label: string;
  width: number;
  height: number;
  obsHint: string;
};

const data = overlaysJson as {
  slides: MarketingOverlaySlide[];
  families: Record<MarketingOverlayFamily, MarketingOverlayFamilyMeta>;
};

export const marketingOverlayFamilies = data.families;

export const marketingOverlaySlides = data.slides;

export const marketingOverlayFamilyOrder: MarketingOverlayFamily[] = [
  "landscape",
  "square",
  "banner",
];

export function slidesForFamily(
  family: MarketingOverlayFamily,
): MarketingOverlaySlide[] {
  return marketingOverlaySlides.filter((slide) => slide.family === family);
}

export function isMarketingOverlayFamily(
  value: string,
): value is MarketingOverlayFamily {
  return value === "landscape" || value === "square" || value === "banner";
}
