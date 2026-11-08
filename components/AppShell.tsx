import type { ReactNode } from "react";

export type AppShellProps = {
  children: ReactNode;
};

/** Shared chrome for checklist session routes. */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-rsi-border/80 bg-rsi-bg-deep/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="mx-auto w-full max-w-6xl">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-rsi-accent">
            JustWorks Digital
          </p>
          <h1 className="text-lg font-semibold tracking-[0.04em] text-rsi-text sm:text-2xl">
            Citizen Wing Commander
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
