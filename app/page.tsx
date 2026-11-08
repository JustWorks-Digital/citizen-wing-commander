"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createChecklistSession,
  fetchChecklistSessions,
} from "@/lib/api/checklistApi";
import { appPaths } from "@/lib/appPaths";
import { AppShell } from "@/components/AppShell";

/** Resolve active session and send the browser to `/sessions/[sessionId]`. */
export default function Home() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchChecklistSessions();
        let sessionId = list.activeSessionId;
        if (!sessionId || list.sessions.length === 0) {
          const created = await createChecklistSession({
            sessionName: "New session",
          });
          sessionId = created.id;
        }
        if (cancelled) return;
        router.replace(appPaths.session(sessionId));
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to open a hauling session",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <AppShell>
      {error ? (
        <p className="text-sm text-rsi-warn">{error}</p>
      ) : (
        <p className="font-mono text-sm text-rsi-text-muted">Opening session…</p>
      )}
    </AppShell>
  );
}
