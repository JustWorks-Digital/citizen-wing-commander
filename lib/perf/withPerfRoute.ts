import { NextResponse } from "next/server";
import { isPerfCaptureEnabled, timeAsync } from "@/lib/perf/capture";
import { recordServerSample } from "@/lib/perf/recordServer";

type RouteHandler = (
  request: Request,
  context?: unknown,
) => Promise<Response> | Response;

/**
 * Wrap an App Router handler to record wall time as kind=api (server) in dev.
 */
export function withPerfRoute(name: string, handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    if (!isPerfCaptureEnabled()) {
      return handler(request, context);
    }
    const method = request.method;
    try {
      const { result, sample } = await timeAsync(
        name,
        "api",
        async () => handler(request, context),
        {
          method,
          source: "server",
          path: new URL(request.url).pathname,
        },
      );
      sample.tags = {
        ...sample.tags,
        status: result.status,
      };
      recordServerSample(sample);
      return result;
    } catch (error) {
      recordServerSample({
        at: new Date().toISOString(),
        kind: "api",
        name,
        value: 0,
        unit: "ms",
        tags: {
          method,
          source: "server",
          error: true,
        },
      });
      throw error;
    }
  };
}

/** Helper when the handler already returned and you only need a sample. */
export function perfJson(
  name: string,
  ms: number,
  status: number,
  extra?: Record<string, string | number | boolean>,
): void {
  if (!isPerfCaptureEnabled()) return;
  recordServerSample({
    at: new Date().toISOString(),
    kind: "api",
    name,
    value: ms,
    unit: "ms",
    tags: { source: "server", status, ...extra },
  });
}

export function asNextJson(
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  return NextResponse.json(body, init);
}
