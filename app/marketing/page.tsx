import { AppShell } from "@/components/AppShell";
import { MarketingGallery } from "@/components/marketing/MarketingGallery";

export default function MarketingPage() {
  return (
    <AppShell activeNav="marketing">
      <MarketingGallery />
    </AppShell>
  );
}
