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
  args: {
    visibleKeys: [...CATALOG_TABLE_COLUMN_KEYS],
    onChange: () => undefined,
  },
} satisfies Meta<typeof CatalogColumnsMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: function DefaultMenu(args) {
    const [visible, setVisible] = useState<CatalogTableColumnKey[]>(
      args.visibleKeys,
    );
    return (
      <div className="flex justify-end bg-rsi-surface p-6">
        <CatalogColumnsMenu visibleKeys={visible} onChange={setVisible} />
      </div>
    );
  },
};

export const SomeHidden: Story = {
  args: {
    visibleKeys: ["id", "reward", "scu", "from", "to", "cargo"],
  },
  render: function SomeHiddenMenu(args) {
    const [visible, setVisible] = useState<CatalogTableColumnKey[]>(
      args.visibleKeys,
    );
    return (
      <div className="flex justify-end bg-rsi-surface p-6">
        <CatalogColumnsMenu visibleKeys={visible} onChange={setVisible} />
      </div>
    );
  },
};
