import { AppShell } from "@/components/AppShell";
import { IntakeUploadsView } from "@/components/intake/IntakeUploadsView";

export default function IntakePage() {
  return (
    <AppShell activeNav="intake">
      <IntakeUploadsView />
    </AppShell>
  );
}
