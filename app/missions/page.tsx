import { AppShell } from "@/components/AppShell";
import { MissionsCatalogView } from "@/components/catalog/MissionsCatalogView";

export default function MissionsCatalogPage() {
  return (
    <AppShell activeNav="missions">
      <MissionsCatalogView />
    </AppShell>
  );
}
