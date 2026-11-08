import type { Meta, StoryObj } from "@storybook/nextjs-vite";

function TypographyScale() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.22em] text-rsi-accent">
          Foundation / Typography
        </p>
        <h1 className="text-2xl font-semibold text-rsi-text">Type scale</h1>
        <p className="mt-2 text-sm text-rsi-text-secondary">
          Display/UI: Exo 2 (stand-in for RSI Univia Pro). Mono: JetBrains Mono for labels and
          telemetry.
        </p>
      </div>

      <div className="space-y-5 rounded-rsi border border-rsi-border bg-rsi-surface p-6">
        <div>
          <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.24em] text-rsi-text-muted">
            Display
          </p>
          <p className="text-4xl font-semibold tracking-wide text-rsi-text">
            Citizen Wing Commander
          </p>
        </div>
        <div>
          <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.24em] text-rsi-text-muted">
            Title
          </p>
          <p className="text-2xl font-semibold text-rsi-text">Operations brief</p>
        </div>
        <div>
          <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.24em] text-rsi-text-muted">
            Body
          </p>
          <p className="text-base leading-relaxed text-rsi-text-secondary">
            Dark industrial surfaces with cornflower accent — keep hierarchy quiet and
            technical, closer to Spectrum than marketing splash pages.
          </p>
        </div>
        <div>
          <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.24em] text-rsi-text-muted">
            Muted / caption
          </p>
          <p className="text-sm text-rsi-text-muted">
            Secondary metadata, timestamps, and system annotations.
          </p>
        </div>
        <div>
          <p className="mb-1 font-mono text-[0.65rem] uppercase tracking-[0.24em] text-rsi-text-muted">
            Mono label
          </p>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-rsi-accent">
            Channel · SC / GENERAL
          </p>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: "Foundation/Typography",
  component: TypographyScale,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof TypographyScale>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Scale: Story = {};
