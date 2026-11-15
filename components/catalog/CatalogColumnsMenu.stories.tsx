import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { CatalogColumnsMenu } from "./CatalogColumnsMenu";
import {
  CATALOG_TABLE_COLUMN_KEYS,
  type CatalogTableColumnKey,
} from "@/lib/missions/catalogTableColumnPrefs";

const meta = {
  title: "Catalog/CatalogColumnsMenu",
  component: CatalogColumnsMenu,
  parameters: { layout: "padded" },
} satisfies Meta<typeof CatalogColumnsMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function DefaultMenu() {
    const [visible, setVisible] = useState<CatalogTableColumnKey[]>([
      ...CATALOG_TABLE_COLUMN_KEYS,
    ]);
    return (
      <div className="flex justify-end bg-rsi-surface p-6">
        <CatalogColumnsMenu visibleKeys={visible} onChange={setVisible} />
      </div>
    );
  },
};

export const SomeHidden: Story = {
  render: function SomeHiddenMenu() {
    const [visible, setVisible] = useState<CatalogTableColumnKey[]>([
      "id",
      "reward",
      "scu",
      "from",
      "to",
      "cargo",
    ]);
    return (
      <div className="flex justify-end bg-rsi-surface p-6">
        <CatalogColumnsMenu visibleKeys={visible} onChange={setVisible} />
      </div>
    );
  },
};
