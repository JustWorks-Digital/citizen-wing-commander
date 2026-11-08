import { SessionChecklistView } from "@/components/missions/SessionChecklistView";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-rsi-border/80 bg-rsi-bg-deep/70 px-6 py-4 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-rsi-accent">
            JustWorks Digital
          </p>
          <h1 className="text-xl font-semibold tracking-[0.04em] text-rsi-text sm:text-2xl">
            Citizen Wing Commander
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <SessionChecklistView />
      </main>
    </div>
  );
}
