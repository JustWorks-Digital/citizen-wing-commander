import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { MissionsCatalogView } from "@/components/catalog/MissionsCatalogView";

export default function MissionsCatalogPage() {
  return (
    <AppShell activeNav="missions">
      <Suspense
        fallback={
          <p className="font-mono text-sm text-rsi-text-muted">
            Loading catalog…
          </p>
        }
      >
        <MissionsCatalogView />
      </Suspense>
    </AppShell>
  );
}
