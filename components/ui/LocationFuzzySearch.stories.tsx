import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LocationFuzzySearch } from "./LocationFuzzySearch";

const meta = {
  title: "Primitives/LocationFuzzySearch",
  component: LocationFuzzySearch,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Fuzzy location search. When a value or typed query is present, a clear (X) control sits on the right edge of the input.",
      },
    },
  },
  args: {
    valueSlug: null as string | null,
    onChange: () => undefined,
  },
} satisfies Meta<typeof LocationFuzzySearch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Preselected: Story = {
  args: {
    valueSlug: "everus-harbor",
  },
};

export const Interactive: Story = {
  render: function InteractiveRender() {
    const [slug, setSlug] = useState<string | null>("everus-harbor");
    return (
      <div className="max-w-md bg-rsi-bg p-6">
        <LocationFuzzySearch valueSlug={slug} onChange={setSlug} />
        <p className="mt-4 font-mono text-xs text-rsi-text-muted">
          Selected slug: {slug ?? "null"}
        </p>
      </div>
    );
  },
};
