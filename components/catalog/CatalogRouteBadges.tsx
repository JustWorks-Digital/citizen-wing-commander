import type { CatalogMission } from "@/db/schema";
import {
  catalogCargoBadgeItems,
  type CatalogLocationBadgeItem,
} from "@/lib/missions/catalogMissionDisplay";
import {
  commodityBadgeBackground,
  commodityBadgeBorder,
  commodityBadgeForeground,
  resolveCommodityColorHex,
} from "@/lib/fixtures/commodityColors";
import { SCU_TITLE } from "@/lib/ui/abbrevTitles";

/** Shared chip size for From / To / Cargo so badges align. */
const catalogBadgeClass =
  "inline-flex h-5 max-w-full items-center rounded-rsi border px-1.5 font-mono text-[0.6rem] leading-none tracking-wide";

const locationBadgeToneClass = {
  from: "border-rsi-accent/45 bg-rsi-accent-muted/50 text-rsi-accent",
  to: "border-rsi-success/45 bg-rsi-success-muted/70 text-rsi-success",
} as const;

export type CatalogLocationBadgeTone = keyof typeof locationBadgeToneClass;

export function CatalogLocationBadges({
  items,
  tone,
}: {
  items: CatalogLocationBadgeItem[];
  tone: CatalogLocationBadgeTone;
}) {
  if (items.length === 0) return <span>—</span>;
  return (
    <ul className="flex flex-wrap gap-1">
      {items.map((item) => (
        <li key={item.slug} className="min-w-0 max-w-full">
          <span
            title={item.name}
            className={[
              "inline-flex min-h-5 max-w-full items-center rounded-rsi border px-1.5 py-0.5",
              "font-mono text-[0.6rem] leading-snug tracking-wide",
              locationBadgeToneClass[tone],
            ].join(" ")}
          >
            <span className="min-w-0 break-words whitespace-normal">
              {item.label}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CatalogCargoBadges({ mission }: { mission: CatalogMission }) {
  const items = catalogCargoBadgeItems(mission);
  if (items.length === 0) return <span>—</span>;
  return (
    <ul className="flex flex-wrap gap-1">
      {items.map((item, index) => {
        const hex = item.commoditySlug
          ? resolveCommodityColorHex(null, null, item.commoditySlug)
          : null;
        const title =
          item.commoditySlug && item.scu > 0
            ? `${item.scu} ${SCU_TITLE} ${item.commodityName}`
            : item.commodityName;
        return (
          <li key={`${item.commoditySlug || "scu"}-${index}`}>
            <span
              title={title}
              className={catalogBadgeClass}
              style={
                hex
                  ? {
                      backgroundColor: commodityBadgeBackground(hex),
                      borderColor: commodityBadgeBorder(hex),
                      color: commodityBadgeForeground(hex),
                    }
                  : {
                      backgroundColor: "var(--rsi-bg-deep)",
                      borderColor: "var(--rsi-border)",
                      color: "var(--rsi-text-secondary)",
                    }
              }
            >
              <span className="min-w-0 truncate">{item.commodityName}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
