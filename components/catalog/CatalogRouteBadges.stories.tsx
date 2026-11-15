import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  CatalogCargoBadges,
  CatalogLocationBadges,
} from "./CatalogRouteBadges";
import { sampleCatalogMissions } from "./missionCatalogFixtures";

const mission = sampleCatalogMissions[0]!;

const meta = {
  title: "Catalog/CatalogRouteBadges",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const FromToAndCargo: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3 rounded-rsi border border-rsi-border bg-rsi-surface p-4">
      <div>
        <p className="mb-1 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          From
        </p>
        <CatalogLocationBadges
          items={[
            {
              slug: "port-tressler",
              name: "Port Tressler",
              label: "Tressler",
            },
          ]}
          tone="from"
        />
      </div>
      <div>
        <p className="mb-1 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          To
        </p>
        <CatalogLocationBadges
          items={[
            {
              slug: "everus-harbor",
              name: "Everus Harbor",
              label: "Everus",
            },
          ]}
          tone="to"
        />
      </div>
      <div>
        <p className="mb-1 font-mono text-[0.55rem] uppercase tracking-[0.16em] text-rsi-text-muted">
          Cargo
        </p>
        <CatalogCargoBadges mission={mission} />
      </div>
    </div>
  ),
};
