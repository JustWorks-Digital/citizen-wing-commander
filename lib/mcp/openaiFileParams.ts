import { z } from "zod";

/**
 * OpenAI Apps / ChatGPT MCP file inputs.
 * @see https://developers.openai.com/apps-sdk/reference — Define file inputs
 *
 * List each top-level file field in `_meta["openai/fileParams"]`. Each file
 * object must declare download_url, file_id, mime_type, and file_name;
 * only download_url + file_id are required at runtime.
 */
export const OPENAI_FILE_PARAMS_META_KEY = "openai/fileParams" as const;

/** Top-level `store_hauling_screenshot` param ChatGPT injects attachments into. */
export const STORE_HAULING_SCREENSHOT_FILE_PARAM = "file" as const;

/**
 * ChatGPT attachment object (snake_case fields).
 * Declares all four properties so Scan Tools / plugin submission accept it.
 */
export const openaiChatFileSchema = z
  .object({
    download_url: z
      .string()
      .describe("Temporary HTTPS URL ChatGPT provides for the attachment"),
    file_id: z.string().describe("OpenAI / ChatGPT file id for this attachment"),
    mime_type: z
      .string()
      .optional()
      .describe("Declared MIME type when ChatGPT supplies it"),
    file_name: z
      .string()
      .optional()
      .describe("Original filename when ChatGPT supplies it"),
  })
  .describe(
    "Native ChatGPT file attachment (openai/fileParams). Prefer this over /mnt/data paths.",
  );

export type OpenAiChatFile = z.infer<typeof openaiChatFileSchema>;

/** Tool `_meta` that marks `file` as a ChatGPT-native attachment slot. */
export const storeHaulingScreenshotOpenAiMeta = {
  [OPENAI_FILE_PARAMS_META_KEY]: [STORE_HAULING_SCREENSHOT_FILE_PARAM],
} as const;

/** Loose parse for runtime values (ChatGPT may omit optional fields). */
export function parseOpenAiChatFile(
  value: unknown,
): { file: OpenAiChatFile } | { error: string } {
  if (value == null) {
    return { error: "file attachment is empty" };
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return { error: "file attachment is empty" };
    }
    return {
      error:
        "file was a string (file id / path) without download_url. ChatGPT must pass the openai/fileParams object { download_url, file_id }. Re-attach the screenshot and call store_hauling_screenshot again.",
    };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return {
      error:
        "file must be an object with download_url and file_id (openai/fileParams)",
    };
  }
  const record = value as Record<string, unknown>;
  const downloadUrl =
    typeof record.download_url === "string" ? record.download_url.trim() : "";
  const fileId =
    typeof record.file_id === "string" ? record.file_id.trim() : "";
  if (!downloadUrl || !fileId) {
    return {
      error:
        "ChatGPT file attachment is missing download_url or file_id (expired or incomplete). Re-attach the screenshot and try again.",
    };
  }
  const mimeType =
    typeof record.mime_type === "string" && record.mime_type.trim()
      ? record.mime_type.trim()
      : undefined;
  const fileName =
    typeof record.file_name === "string" && record.file_name.trim()
      ? record.file_name.trim()
      : undefined;
  return {
    file: {
      download_url: downloadUrl,
      file_id: fileId,
      mime_type: mimeType,
      file_name: fileName,
    },
  };
}
