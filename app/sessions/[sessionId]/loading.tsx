import { AppShell } from "@/components/AppShell";

export default function SessionLoading() {
  return (
    <AppShell activeNav="sessions">
      <p className="font-mono text-sm text-rsi-text-muted">Opening trip…</p>
    </AppShell>
  );
}
