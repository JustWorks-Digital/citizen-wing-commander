import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { SearchableSelect } from "./SearchableSelect";

const meta = {
  title: "UI/SearchableSelect",
  component: SearchableSelect,
  parameters: { layout: "padded" },
  args: {
    label: "From",
    values: [],
    options: ["Everus Harbor", "Lorville", "Area18", "Port Tressler"],
    onChange: () => {},
  },
} satisfies Meta<typeof SearchableSelect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Preselected: Story = {
  args: { values: ["Lorville", "Everus Harbor"] },
};

export const Interactive: Story = {
  render: function InteractiveSelect() {
    const [values, setValues] = useState<string[]>([]);
    return (
      <div className="max-w-xs">
        <SearchableSelect
          label="Cargo"
          values={values}
          onChange={setValues}
          options={["Corundum", "Quartz", "Stims", "Waste"]}
        />
      </div>
    );
  },
};

export const SingleSelect: Story = {
  render: function SingleRouteSelect() {
    const [values, setValues] = useState<string[]>([]);
    return (
      <div className="max-w-xs">
        <SearchableSelect
          label="Route"
          showLabel={false}
          multiple={false}
          values={values}
          onChange={setValues}
          options={["Direct", "Non-direct", "One pickup", "One delivery"]}
          placeholder="Route"
        />
      </div>
    );
  },
};
