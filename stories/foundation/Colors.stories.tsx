import type { Meta, StoryObj } from "@storybook/nextjs-vite";

const tokens = [
  { name: "--rsi-bg", swatch: "bg-rsi-bg", hex: "#0A1D29", group: "Background" },
  { name: "--rsi-bg-deep", swatch: "bg-rsi-bg-deep", hex: "#06141D", group: "Background" },
  { name: "--rsi-surface", swatch: "bg-rsi-surface", hex: "#1C2737", group: "Surface" },
  {
    name: "--rsi-surface-raised",
    swatch: "bg-rsi-surface-raised",
    hex: "#243447",
    group: "Surface",
  },
  {
    name: "--rsi-surface-sunken",
    swatch: "bg-rsi-surface-sunken",
    hex: "#0F2C3E",
    group: "Surface",
  },
  { name: "--rsi-border", swatch: "bg-rsi-border", hex: "#2F4056", group: "Border" },
  {
    name: "--rsi-border-strong",
    swatch: "bg-rsi-border-strong",
    hex: "#3D536D",
    group: "Border",
  },
  { name: "--rsi-text", swatch: "bg-rsi-text", hex: "#F3F6F9", group: "Text" },
  {
    name: "--rsi-text-secondary",
    swatch: "bg-rsi-text-secondary",
    hex: "#A9B3BD",
    group: "Text",
  },
  { name: "--rsi-text-muted", swatch: "bg-rsi-text-muted", hex: "#7D8A97", group: "Text" },
  { name: "--rsi-accent", swatch: "bg-rsi-accent", hex: "#54ADF7", group: "Accent" },
  {
    name: "--rsi-accent-hover",
    swatch: "bg-rsi-accent-hover",
    hex: "#7BC1F9",
    group: "Accent",
  },
  {
    name: "--rsi-accent-muted",
    swatch: "bg-rsi-accent-muted",
    hex: "#1A4A6E",
    group: "Accent",
  },
  { name: "--rsi-gold", swatch: "bg-rsi-gold", hex: "#E0A63A", group: "Accent" },
  { name: "--rsi-danger", swatch: "bg-rsi-danger", hex: "#E25555", group: "Status" },
  { name: "--rsi-warn", swatch: "bg-rsi-warn", hex: "#E0A63A", group: "Status" },
  { name: "--rsi-success", swatch: "bg-rsi-success", hex: "#3DBF8F", group: "Status" },
] as const;

function ColorTokens() {
  const groups = [...new Set(tokens.map((t) => t.group))];

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.22em] text-rsi-accent">
          Foundation / Colors
        </p>
        <h1 className="text-2xl font-semibold text-rsi-text">RSI / Spectrum tokens</h1>
        <p className="mt-2 max-w-2xl text-sm text-rsi-text-secondary">
          Prefer these CSS variables and Tailwind `rsi-*` utilities. Do not scatter one-off
          hex values in components.
        </p>
      </div>

      {groups.map((group) => (
        <section key={group}>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-rsi-text-muted">
            {group}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tokens
              .filter((t) => t.group === group)
              .map((token) => (
                <div
                  key={token.name}
                  className="overflow-hidden rounded-rsi border border-rsi-border bg-rsi-surface"
                >
                  <div className={`h-16 ${token.swatch}`} />
                  <div className="space-y-1 px-3 py-3">
                    <p className="font-mono text-xs text-rsi-text">{token.name}</p>
                    <p className="font-mono text-[0.7rem] text-rsi-text-muted">{token.hex}</p>
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const meta = {
  title: "Foundation/Colors",
  component: ColorTokens,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ColorTokens>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Palette: Story = {};
