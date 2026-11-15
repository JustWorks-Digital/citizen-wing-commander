import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MarketingOverlayCarousel } from "@/components/marketing/MarketingOverlayCarousel";
import {
  isMarketingOverlayFamily,
  marketingOverlayFamilies,
  slidesForFamily,
} from "@/lib/marketing/overlays";

type MarketingObsPageProps = {
  params: Promise<{ family: string }>;
};

async function MarketingObsFromParams({
  params,
}: {
  params: Promise<{ family: string }>;
}) {
  const { family: raw } = await params;
  if (!isMarketingOverlayFamily(raw)) notFound();
  const family = raw;
  const meta = marketingOverlayFamilies[family];
  const slides = slidesForFamily(family);

  return (
    <main
      className="min-h-[100dvh] bg-transparent"
      aria-label={`${meta.label} OBS overlay`}
    >
      <MarketingOverlayCarousel slides={slides} isFullscreen />
    </main>
  );
}

/**
 * Clean fullscreen auto-slideshow for OBS Browser Source.
 * Use landscape / square / banner — no app chrome.
 */
export default function MarketingObsPage({ params }: MarketingObsPageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center bg-rsi-bg-deep">
          <p className="font-mono text-sm text-rsi-text-muted">Loading overlay…</p>
        </main>
      }
    >
      <MarketingObsFromParams params={params} />
    </Suspense>
  );
}
