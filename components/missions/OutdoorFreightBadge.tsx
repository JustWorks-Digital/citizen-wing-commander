"use client";

import { Badge } from "@/components/ui/Badge";
import { OUTDOOR_FREIGHT_TITLE } from "@/lib/ui/abbrevTitles";
import { OutdoorFreightIcon } from "./OutdoorFreightIcon";

export type OutdoorFreightBadgeProps = {
  locationSlug: string;
};

/** Compact outdoor / external freight elevator marker (icon + abbreviated label). */
export function OutdoorFreightBadge({ locationSlug }: OutdoorFreightBadgeProps) {
  return (
    <Badge
      variant="warn"
      size="sm"
      className="gap-0.5"
      title={OUTDOOR_FREIGHT_TITLE}
    >
      <OutdoorFreightIcon
        locationSlug={locationSlug}
        size="xs"
        className="text-current"
      />
      Outdr freight
    </Badge>
  );
}
