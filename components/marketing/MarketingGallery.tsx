"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ImageLightbox,
  type ImageLightboxItem,
} from "@/components/ui/ImageLightbox";
import {
  marketingOverlayFamilies,
  marketingOverlayFamilyOrder,
  marketingOverlaySlides,
  slidesForFamily,
  type MarketingOverlayFamily,
  type MarketingOverlaySlide,
} from "@/lib/marketing/overlays";
import { appPaths } from "@/lib/appPaths";
import { MarketingOverlayCarousel } from "./MarketingOverlayCarousel";

function slideKey(slide: MarketingOverlaySlide): string {
  return `${slide.family}-${slide.id}`;
}

function toLightboxItem(slide: MarketingOverlaySlide): ImageLightboxItem {
  const meta = marketingOverlayFamilies[slide.family];
  return {
    src: slide.file,
    alt: slide.title,
    title: `${slide.title} · ${meta.label}`,
    caption: `${slide.caption}\n${meta.width}×${meta.height} · ${slide.ratio}`,
  };
}

function FamilySection({
  family,
  onOpenSlide,
  onBrowseFamily,
}: {
  family: MarketingOverlayFamily;
  onOpenSlide: (slide: MarketingOverlaySlide) => void;
  onBrowseFamily: (family: MarketingOverlayFamily) => void;
}) {
  const meta = marketingOverlayFamilies[family];
  const slides = slidesForFamily(family);
  const obsPath = appPaths.marketingObs(family);

  return (
    <section className="space-y-4 border border-rsi-border/70 bg-rsi-surface/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-rsi-accent">
            {meta.width}×{meta.height} · {slides[0]?.ratio ?? family}
          </p>
          <h2 className="text-lg font-semibold tracking-[0.04em] text-rsi-text">
            {meta.label}
          </h2>
          <p className="mt-1 text-sm text-rsi-text-secondary">{meta.obsHint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onBrowseFamily(family)}
            className="rounded-rsi border border-rsi-border px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-text-secondary transition-colors hover:border-rsi-accent/60 hover:text-rsi-accent"
          >
            Browse family
          </button>
          <Link
            href={obsPath}
            className="rounded-rsi border border-rsi-border px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-accent transition-colors hover:border-rsi-accent/60 hover:bg-rsi-bg-deep/60"
            target="_blank"
            rel="noreferrer"
          >
            Open OBS source
          </Link>
        </div>
      </div>

      <MarketingOverlayCarousel slides={slides} />

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {slides.map((slide) => (
          <li key={slideKey(slide)}>
            <button
              type="button"
              onClick={() => onOpenSlide(slide)}
              className="w-full overflow-hidden border border-rsi-border/60 bg-rsi-bg-deep/50 text-left transition-colors hover:border-rsi-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]"
              aria-label={`Open slideshow at ${slide.title} (${slide.ratio})`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.file}
                alt={slide.title}
                className="w-full object-cover"
                style={{ aspectRatio: `${slide.width} / ${slide.height}` }}
                width={slide.width}
                height={slide.height}
              />
              <div className="space-y-1 px-3 py-2.5">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-rsi-accent">
                  {slide.title}
                </p>
                <p className="text-xs leading-relaxed text-rsi-text-secondary">
                  {slide.caption}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Review gallery of OBS-ready marketing overlays, grouped by aspect ratio. */
export function MarketingGallery() {
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [filterFamily, setFilterFamily] = useState<
    MarketingOverlayFamily | "all"
  >("all");

  const orderedSlides = useMemo(() => {
    if (filterFamily === "all") {
      return marketingOverlayFamilyOrder.flatMap((family) =>
        slidesForFamily(family),
      );
    }
    return slidesForFamily(filterFamily);
  }, [filterFamily]);

  const lightboxItems = useMemo(
    () => orderedSlides.map(toLightboxItem),
    [orderedSlides],
  );

  const openSlide = (slide: MarketingOverlaySlide) => {
    const inAll = marketingOverlayFamilyOrder.flatMap((family) =>
      slidesForFamily(family),
    );
    const allIndex = inAll.findIndex(
      (entry) => slideKey(entry) === slideKey(slide),
    );
    setFilterFamily("all");
    setSlideshowIndex(Math.max(0, allIndex));
    setSlideshowOpen(true);
  };

  const openFiltered = (
    family: MarketingOverlayFamily | "all",
    startIndex = 0,
  ) => {
    setFilterFamily(family);
    setSlideshowIndex(startIndex);
    setSlideshowOpen(true);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-rsi-accent">
            Stream overlays
          </p>
          <h2 className="text-2xl font-semibold tracking-[0.04em] text-rsi-text">
            Marketing
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-rsi-text-secondary">
            Feature slides sized for OBS. Each family shares one aspect ratio and
            auto-rotates — use the OBS source links as Browser Sources on your
            Twitch scene.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openFiltered("all")}
          className="rounded-rsi border border-rsi-accent/50 bg-rsi-accent/10 px-3.5 py-2 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-rsi-accent transition-colors hover:bg-rsi-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]"
        >
          Browse all ({marketingOverlaySlides.length})
        </button>
      </header>

      {marketingOverlayFamilyOrder.map((family) => (
        <FamilySection
          key={family}
          family={family}
          onOpenSlide={openSlide}
          onBrowseFamily={(next) => openFiltered(next)}
        />
      ))}

      {slideshowOpen && lightboxItems.length > 0 ? (
        <ImageLightbox
          src={lightboxItems[slideshowIndex]?.src ?? lightboxItems[0]!.src}
          alt={lightboxItems[slideshowIndex]?.alt}
          title={lightboxItems[slideshowIndex]?.title}
          caption={lightboxItems[slideshowIndex]?.caption}
          items={lightboxItems}
          index={slideshowIndex}
          onIndexChange={setSlideshowIndex}
          onClose={() => setSlideshowOpen(false)}
        />
      ) : null}
    </div>
  );
}
