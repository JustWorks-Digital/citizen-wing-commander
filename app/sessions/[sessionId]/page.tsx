import { AppShell } from "@/components/AppShell";
import { SessionChecklistView } from "@/components/missions/SessionChecklistView";

type SessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = await params;
  return (
    <AppShell>
      <SessionChecklistView sessionId={sessionId} />
    </AppShell>
  );
}
