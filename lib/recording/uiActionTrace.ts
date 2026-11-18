/** UI action-trace schema for the session recorder → Playwright pipeline. */

export type UiTraceActionType = "click" | "fill" | "keydown" | "navigate";

export type UiTraceAction = {
  ts: number;
  type: UiTraceActionType;
  testId?: string;
  role?: string;
  name?: string;
  value?: string;
  url?: string;
};

export type UiActionTrace = {
  version: 1;
  startedAt: string;
  viewport: { w: number; h: number };
  sessionId?: string | null;
  actions: UiTraceAction[];
};

export const RECORDER_STORAGE_KEY = "cwc.uiRecorder.active";
/** Panel show/hide preference (`1` open, `0` hidden). Survives page reload. */
export const RECORDER_PANEL_STORAGE_KEY = "cwc.uiRecorder.panelOpen";

export function emptyUiActionTrace(
  partial?: Partial<Pick<UiActionTrace, "sessionId">>,
): UiActionTrace {
  return {
    version: 1,
    startedAt: new Date().toISOString(),
    viewport: {
      w: typeof window !== "undefined" ? window.innerWidth : 0,
      h: typeof window !== "undefined" ? window.innerHeight : 0,
    },
    sessionId: partial?.sessionId ?? null,
    actions: [],
  };
}
