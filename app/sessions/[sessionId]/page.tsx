import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { SessionChecklistView } from "@/components/missions/SessionChecklistView";

type SessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

async function SessionChecklistFromParams({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <SessionChecklistView sessionId={sessionId} />;
}

export default function SessionPage({ params }: SessionPageProps) {
  return (
    <AppShell activeNav="sessions">
      <Suspense
        fallback={
          <p className="font-mono text-sm text-rsi-text-muted">
            Opening session…
          </p>
        }
      >
        <SessionChecklistFromParams params={params} />
      </Suspense>
    </AppShell>
  );
}
