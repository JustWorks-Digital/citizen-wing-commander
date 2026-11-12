/**
 * Stream-ready sponsor card (OBS / Steam overlay screenshot).
 * Open `/sponsor` fullscreen, capture the viewport.
 */
export default function SponsorPage() {
  return (
    <main
      className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-rsi-bg-deep"
      aria-label="Citizen Wing Commander sponsor card"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_70%_55%,rgba(84,173,247,0.12),transparent_55%),radial-gradient(ellipse_60%_50%_at_15%_20%,rgba(28,39,55,0.9),transparent_50%),linear-gradient(160deg,var(--rsi-bg)_0%,var(--rsi-bg-deep)_55%,#041018_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-100 [background-image:linear-gradient(rgba(84,173,247,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(84,173,247,0.035)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,black,transparent_75%)] motion-safe:animate-[sponsor-grid_28s_linear_infinite]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[8%] top-[18%] size-[42vw] rounded-full bg-[radial-gradient(circle,rgba(84,173,247,0.18),transparent_68%)] blur-md motion-safe:animate-[sponsor-glow_6s_ease-in-out_infinite]"
      />

      <div className="relative z-10 grid w-[min(1680px,94vw)] grid-cols-1 items-center gap-8 py-10 md:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.35fr)] md:gap-12 lg:h-[min(920px,92vh)] lg:py-0">
        <section className="flex max-w-md flex-col gap-4 motion-safe:animate-[sponsor-rise_0.9s_cubic-bezier(0.22,1,0.36,1)_both]">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.28em] text-rsi-accent">
            JustWorks Digital
          </p>
          <h1 className="text-balance text-[clamp(2rem,3.4vw,3.15rem)] font-bold leading-[1.05] tracking-[0.04em] text-rsi-text">
            Citizen Wing Commander
          </h1>
          <p className="border-l-2 border-rsi-accent pl-3.5 font-mono text-[clamp(0.95rem,1.5vw,1.2rem)] font-medium uppercase tracking-[0.22em] text-rsi-text motion-safe:animate-[sponsor-rise_1s_0.12s_cubic-bezier(0.22,1,0.36,1)_both]">
            Now entering into beta
          </p>
          <p className="max-w-[22rem] text-[clamp(0.95rem,1.2vw,1.1rem)] leading-relaxed text-rsi-text-secondary motion-safe:animate-[sponsor-rise_1s_0.22s_cubic-bezier(0.22,1,0.36,1)_both]">
            Plan hauling trips with your crew — stop cargo, bay packing, and
            contract completions in one tactical view.
          </p>
        </section>

        <section
          className="relative min-h-[420px] w-full motion-safe:animate-[sponsor-rise_1.05s_0.18s_cubic-bezier(0.22,1,0.36,1)_both] md:h-full md:min-h-[520px]"
          aria-label="App UI preview"
        >
          <div className="absolute inset-0 overflow-hidden border border-rsi-border/80 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--rsi-surface)_55%,transparent),color-mix(in_srgb,var(--rsi-bg-deep)_70%,transparent))] shadow-[0_0_0_1px_rgba(84,173,247,0.08)_inset,0_28px_80px_rgba(0,0,0,0.45)]">
            <span
              aria-hidden
              className="absolute left-2.5 top-2.5 size-[18px] border-l border-t border-rsi-accent/70"
            />
            <span
              aria-hidden
              className="absolute right-2.5 top-2.5 size-[18px] border-r border-t border-rsi-accent/70"
            />
            <span
              aria-hidden
              className="absolute bottom-2.5 left-2.5 size-[18px] border-b border-l border-rsi-accent/70"
            />
            <span
              aria-hidden
              className="absolute bottom-2.5 right-2.5 size-[18px] border-b border-r border-rsi-accent/70"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-[3] bg-[linear-gradient(180deg,transparent_0%,rgba(84,173,247,0.07)_50%,transparent_100%)] bg-[length:100%_220%] mix-blend-screen motion-safe:animate-[sponsor-scan_5.5s_ease-in-out_infinite]"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sponsor/ui-pickup.png"
              alt="Citizen Wing Commander pickup stop with cargo bay layout"
              className="absolute left-[2%] top-[4%] z-[2] w-[92%] drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)] motion-safe:animate-[sponsor-float-a_7s_ease-in-out_infinite]"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sponsor/ui-delivery.png"
              alt="Citizen Wing Commander delivery stop with completions and aUEC total"
              className="absolute bottom-[3%] right-[1%] z-[1] w-[78%] opacity-90 drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)] motion-safe:animate-[sponsor-float-b_8.5s_ease-in-out_infinite]"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
