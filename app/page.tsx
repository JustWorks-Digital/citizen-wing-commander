import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-rsi-border/80 bg-rsi-bg-deep/70 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-rsi-accent">
              JustWorks Digital
            </p>
            <h1 className="text-xl font-semibold tracking-[0.04em] text-rsi-text sm:text-2xl">
              Citizen Wing Commander
            </h1>
          </div>
          <Button variant="secondary">Spectrum</Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 px-6 py-16">
        <div className="max-w-2xl">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.24em] text-rsi-text-muted">
            Companion systems online
          </p>
          <h2 className="mb-4 text-3xl font-semibold leading-tight tracking-wide text-rsi-text sm:text-4xl">
            Dark industrial UI keyed to RSI &amp; Spectrum.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-rsi-text-secondary">
            Theme tokens, Tailwind utilities, and Storybook foundations are
            wired for a design system that can grow with the fleet.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Panel eyebrow="Channel" title="Operations brief">
            <p className="mb-4 text-sm leading-relaxed">
              Use{" "}
              <code className="rounded-rsi bg-rsi-bg-deep px-1.5 py-0.5 font-mono text-rsi-accent">
                bg-rsi-*
              </code>{" "}
              and CSS variables — avoid one-off hex in components.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button>Launch Storybook</Button>
              <Button variant="ghost">View tokens</Button>
            </div>
          </Panel>

          <Panel eyebrow="Status" title="Systems check">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-rsi-success" />
                Tailwind v4 theme bridge active
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-rsi-accent" />
                RSI accent / Spectrum surfaces loaded
              </li>
              <li className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-rsi-warn" />
                Storybook required before UI commits
              </li>
            </ul>
          </Panel>
        </div>
      </main>
    </div>
  );
}
