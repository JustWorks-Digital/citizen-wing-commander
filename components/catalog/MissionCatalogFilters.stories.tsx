import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import type { CatalogTableFilters } from "@/lib/missions/catalogMissionTableQuery";
import {
  CATALOG_TABLE_COLUMN_KEYS,
  type CatalogTableColumnKey,
} from "@/lib/missions/catalogTableColumnPrefs";
import { MissionCatalogFilters } from "./MissionCatalogFilters";
import { sampleCatalogMissions } from "./missionCatalogFixtures";

const meta = {
  title: "Catalog/MissionCatalogFilters",
  component: MissionCatalogFilters,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Desktop: search beside a 2×3 filter grid (Route type / Category / Rank, then From / To / Cargo).",
      },
    },
  },
  args: {
    missions: sampleCatalogMissions,
    query: "",
    onQueryChange: () => {},
    filters: {},
    onFiltersChange: () => {},
    resultCount: 2,
    totalCount: 3,
    visibleColumns: [...CATALOG_TABLE_COLUMN_KEYS],
    onVisibleColumnsChange: () => {},
  },
} satisfies Meta<typeof MissionCatalogFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ActiveFilters: Story = {
  args: {
    query: "quartz",
    filters: {
      route: ["One pickup"],
      from: ["Everus Harbor"],
      rank: ["Junior", "Rookie"],
      category: ["Local"],
    },
    resultCount: 1,
    totalCount: 3,
  },
};

export const Interactive: Story = {
  render: function InteractiveFilters() {
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState<CatalogTableFilters>({});
    const [visibleColumns, setVisibleColumns] = useState<
      CatalogTableColumnKey[]
    >([...CATALOG_TABLE_COLUMN_KEYS]);
    return (
      <MissionCatalogFilters
        missions={sampleCatalogMissions}
        query={query}
        onQueryChange={setQuery}
        filters={filters}
        onFiltersChange={setFilters}
        resultCount={2}
        totalCount={3}
        visibleColumns={visibleColumns}
        onVisibleColumnsChange={setVisibleColumns}
      />
    );
  },
};
