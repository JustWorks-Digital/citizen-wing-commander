import { AppShell } from "@/components/AppShell";
import { IntakeUploadsView } from "@/components/intake/IntakeUploadsView";

export default function CapturePage() {
  return (
    <AppShell activeNav="capture">
      <IntakeUploadsView />
    </AppShell>
  );
}
