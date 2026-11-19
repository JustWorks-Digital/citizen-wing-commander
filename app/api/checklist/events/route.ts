import { connection } from "next/server";
import {
  subscribeChecklistSse,
  type ChecklistSseEvent,
} from "@/lib/sessions/checklistSseHub";

const HEARTBEAT_MS = 20_000;

function sessionIdFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("sessionId");
  return fromQuery?.trim() || null;
}

function encodeSse(event: string, data: unknown): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

function encodeComment(text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`: ${text}\n\n`);
}

/**
 * Server-Sent Events stream for near-real-time checklist sync.
 * Client: EventSource(appApi.checklistEvents(sessionId)).
 */
export async function GET(request: Request): Promise<Response> {
  // Request-bound stream (Cache Components — no export const dynamic).
  await connection();
  const sessionId = sessionIdFromRequest(request);
  if (!sessionId) {
    return Response.json(
      { error: "sessionId query param is required" },
      { status: 400 },
    );
  }

  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        unsubscribe?.();
        unsubscribe = null;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      unsubscribe = subscribeChecklistSse(
        sessionId,
        (event: ChecklistSseEvent) => {
          safeEnqueue(encodeSse("checklist_updated", event));
        },
      );

      safeEnqueue(
        encodeSse("connected", {
          type: "connected",
          sessionId,
          at: new Date().toISOString(),
        }),
      );

      heartbeat = setInterval(() => {
        safeEnqueue(encodeComment("ping"));
      }, HEARTBEAT_MS);

      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      closed = true;
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      unsubscribe?.();
      unsubscribe = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
