import { describe, expect, it } from "vitest";
import { imageResult } from "@/lib/mcp/toolResults";

describe("imageResult", () => {
  it("keeps base64 out of the JSON text block and in type image", () => {
    const data = "aGVsbG8="; // hello
    const result = imageResult({
      meta: {
        ok: true,
        logicalPath: "intake-pending/shot.png",
        filename: "shot.png",
        bytes: 5,
        contentType: "image/png",
      },
      imageBase64: data,
      mimeType: "image/png",
    });

    expect(result.content).toHaveLength(2);
    expect(result.content[0]).toMatchObject({ type: "text" });
    expect(result.content[0]!.type).toBe("text");
    if (result.content[0]!.type !== "text") return;
    expect(result.content[0].text).not.toContain(data);
    expect(result.content[0].text).toContain("intake-pending/shot.png");

    expect(result.content[1]).toEqual({
      type: "image",
      mimeType: "image/png",
      data,
    });
  });
});
