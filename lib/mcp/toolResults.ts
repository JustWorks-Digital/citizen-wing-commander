/**
 * MCP tool result helpers (no server-only imports — safe for unit tests).
 */

export function textResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export type McpTextResult = ReturnType<typeof textResult>;

/**
 * MCP image content for screenshot tools.
 * Keep metadata in a small JSON text block — do **not** embed base64 there
 * (ChatGPT / hosts choke on multi‑MB JSON strings). Put bytes in `type: image`.
 */
export function imageResult(input: {
  meta: Record<string, unknown>;
  imageBase64: string;
  mimeType: string;
}) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(input.meta, null, 2),
      },
      {
        type: "image" as const,
        mimeType: input.mimeType,
        data: input.imageBase64,
      },
    ],
  };
}

export type McpImageResult = ReturnType<typeof imageResult>;

/** Merge fields into a successful tool JSON payload (leave error responses alone). */
export function mergeTextResult(
  result: McpTextResult,
  extra: Record<string, unknown>,
): McpTextResult {
  const block = result.content[0];
  if (!block || block.type !== "text") return textResult(extra);
  try {
    const parsed = JSON.parse(block.text) as Record<string, unknown>;
    if (typeof parsed.error === "string") return result;
    return textResult({ ...parsed, ...extra });
  } catch {
    return result;
  }
}
