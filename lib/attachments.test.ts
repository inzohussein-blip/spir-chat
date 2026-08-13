import { describe, it, expect } from "vitest";
import {
  isImageType,
  sanitizeFileName,
  validateUpload,
  parseAttachments,
  buildAttachmentPath,
  MAX_ATTACHMENT_BYTES,
} from "./attachments";

describe("isImageType", () => {
  it("detects images", () => {
    expect(isImageType("image/png")).toBe(true);
    expect(isImageType("application/pdf")).toBe(false);
    expect(isImageType("")).toBe(false);
  });
});

describe("sanitizeFileName", () => {
  it("strips paths and unsafe characters", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("my report (v2).pdf")).toBe("my report v2.pdf");
    expect(sanitizeFileName("")).toBe("file");
  });
});

describe("validateUpload", () => {
  it("accepts an allowed type within the size limit", () => {
    expect(validateUpload({ type: "image/png", size: 1000 })).toBeNull();
  });
  it("rejects oversize files", () => {
    expect(
      validateUpload({ type: "image/png", size: MAX_ATTACHMENT_BYTES + 1 })
    ).toMatch(/too large/i);
  });
  it("rejects unsupported types", () => {
    expect(validateUpload({ type: "application/x-msdownload", size: 10 })).toMatch(
      /unsupported/i
    );
  });
  it("rejects empty files", () => {
    expect(validateUpload({ type: "image/png", size: 0 })).toMatch(/no file/i);
  });
});

describe("parseAttachments", () => {
  it("keeps valid entries and drops junk", () => {
    expect(
      parseAttachments([
        { url: "u", name: "n", type: "image/png", size: 5 },
        { name: "no url" },
        null,
        "x",
      ])
    ).toEqual([{ url: "u", name: "n", type: "image/png", size: 5 }]);
  });
  it("returns [] for non-arrays", () => {
    expect(parseAttachments(null)).toEqual([]);
    expect(parseAttachments("nope")).toEqual([]);
  });
  it("fills defaults for missing optional fields", () => {
    expect(parseAttachments([{ url: "u" }])).toEqual([
      { url: "u", name: "file", type: "", size: 0 },
    ]);
  });
});

describe("buildAttachmentPath", () => {
  it("nests under the conversation id and keeps the filename", () => {
    const p = buildAttachmentPath("conv-1", "photo.png");
    expect(p.startsWith("conv-1/")).toBe(true);
    expect(p.endsWith("photo.png")).toBe(true);
  });
});
