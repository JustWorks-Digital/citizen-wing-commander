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

/** Compact chip for amount labels under contract titles. */
const cargoAmountBadgeClass =
  "inline-flex h-[1.125rem] max-w-full items-center rounded-rsi border px-1 font-mono text-[0.55rem] leading-none tracking-wide";

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
              item.isCompleted
                ? "opacity-70 line-through decoration-rsi-success/50"
                : "",
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

export type CargoAmountBadgeItem = {
  commoditySlug: string;
  commodityName: string;
  scu: number;
  isCompleted?: boolean;
};

function cargoBadgeStyle(commoditySlug: string | null | undefined) {
  const hex = commoditySlug
    ? resolveCommodityColorHex(null, null, commoditySlug)
    : null;
  if (!hex) {
    return {
      backgroundColor: "var(--rsi-bg-deep)",
      borderColor: "var(--rsi-border)",
      color: "var(--rsi-text-secondary)",
    };
  }
  return {
    backgroundColor: commodityBadgeBackground(hex),
    borderColor: commodityBadgeBorder(hex),
    color: commodityBadgeForeground(hex),
  };
}

/** Amount + commodity chips (contracts modal under title, etc.). */
export function CargoAmountBadges({
  items,
}: {
  items: CargoAmountBadgeItem[];
}) {
  if (items.length === 0) return <span>—</span>;
  return (
    <ul className="flex flex-wrap gap-x-1 gap-y-0.5">
      {items.map((item, index) => {
        const title =
          item.scu > 0
            ? `${item.scu} ${SCU_TITLE} ${item.commodityName}`
            : item.commodityName;
        return (
          <li key={`${item.commoditySlug || "scu"}-${index}`}>
            <span
              title={title}
              className={[
                cargoAmountBadgeClass,
                item.isCompleted
                  ? "opacity-70 line-through decoration-rsi-success/50"
                  : "",
              ].join(" ")}
              style={cargoBadgeStyle(item.commoditySlug)}
            >
              <span className="min-w-0 truncate">
                {item.scu > 0 ? (
                  <>
                    <span className="tabular-nums">{item.scu}</span>{" "}
                    <span className="text-[0.45rem] tracking-wide" title={SCU_TITLE}>
                      SCU
                    </span>{" "}
                    {item.commodityName}
                  </>
                ) : (
                  item.commodityName
                )}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function CatalogCargoBadges({ mission }: { mission: CatalogMission }) {
  const items = catalogCargoBadgeItems(mission);
  if (items.length === 0) return <span>—</span>;
  return (
    <ul className="flex flex-wrap gap-1">
      {items.map((item, index) => {
        const title =
          item.commoditySlug && item.scu > 0
            ? `${item.scu} ${SCU_TITLE} ${item.commodityName}`
            : item.commodityName;
        return (
          <li key={`${item.commoditySlug || "scu"}-${index}`}>
            <span
              title={title}
              className={catalogBadgeClass}
              style={cargoBadgeStyle(item.commoditySlug)}
            >
              <span className="min-w-0 truncate">{item.commodityName}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
