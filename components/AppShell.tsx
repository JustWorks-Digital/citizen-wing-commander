import type { ReactNode } from "react";
import Link from "next/link";
import { appPaths } from "@/lib/appPaths";

export type AppShellNav = "sessions" | "missions" | "intake";

export type AppShellProps = {
  children: ReactNode;
  /** Highlights the active primary nav item. */
  activeNav?: AppShellNav;
};

const navLinkClass = (active: boolean) =>
  [
    "rounded-rsi px-2.5 py-1.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsi-ring)]",
    active
      ? "bg-rsi-surface text-rsi-accent"
      : "text-rsi-text-muted hover:text-rsi-text",
  ].join(" ");

/** Shared chrome for checklist session and catalog routes. */
export function AppShell({ children, activeNav }: AppShellProps) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-rsi-border/80 bg-rsi-bg-deep/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-rsi-accent">
              JustWorks Digital
            </p>
            <h1 className="text-lg font-semibold tracking-[0.04em] text-rsi-text sm:text-2xl">
              Citizen Wing Commander
            </h1>
          </div>
          <nav
            aria-label="Primary"
            className="flex flex-wrap items-center gap-1"
          >
            <Link
              href={appPaths.sessions}
              className={navLinkClass(activeNav === "sessions")}
              aria-current={activeNav === "sessions" ? "page" : undefined}
            >
              Trips
            </Link>
            <Link
              href={appPaths.missionsCatalog}
              className={navLinkClass(activeNav === "missions")}
              aria-current={activeNav === "missions" ? "page" : undefined}
            >
              Contracts
            </Link>
            <Link
              href={appPaths.intake}
              className={navLinkClass(activeNav === "intake")}
              aria-current={activeNav === "intake" ? "page" : undefined}
            >
              Intake
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
