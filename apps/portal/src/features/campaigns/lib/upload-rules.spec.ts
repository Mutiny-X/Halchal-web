import { describe, expect, it } from "vitest";

import { checkCoverFile, checkMediaFile, checkSourceFile } from "./upload-rules";

const MB = 1024 * 1024;
const fakeFile = (type: string, size: number) => ({ type, size }) as File;

describe("upload rules (match the API)", () => {
  it("covers: JPEG/PNG/WebP up to 10 MB", () => {
    expect(checkCoverFile(fakeFile("image/png", 2 * MB))).toBeNull();
    expect(checkCoverFile(fakeFile("image/svg+xml", 1))).toMatch(/JPEG, PNG or WebP/);
    expect(checkCoverFile(fakeFile("image/gif", 1))).toMatch(/JPEG, PNG or WebP/);
    expect(checkCoverFile(fakeFile("image/jpeg", 11 * MB))).toMatch(/max is 10MB/);
  });

  it("samples: only the media types the API accepts", () => {
    expect(checkMediaFile(fakeFile("video/mp4", MB), "video")).toBeNull();
    expect(checkMediaFile(fakeFile("image/gif", MB), "image")).toBeNull();
    expect(checkMediaFile(fakeFile("image/svg+xml", 1))).not.toBeNull();
    expect(checkMediaFile(fakeFile("text/html", 1))).not.toBeNull();
    expect(checkMediaFile(fakeFile("video/mp4", 1), "image")).toMatch(/Images must be/);
    expect(checkMediaFile(fakeFile("video/mp4", 6 * 1024 * MB))).toMatch(/max is 4.9GB/);
  });
});

describe("source files from device (3 GB)", () => {
  const GB = 1024 * MB;
  it("allows up to exactly 3 GB", () => {
    expect(checkSourceFile(fakeFile("video/mp4", 3 * GB))).toBeNull();
  });
  it("refuses anything larger, saying the size, the limit and what to do", () => {
    expect(checkSourceFile(fakeFile("video/mp4", 3.4 * GB))).toBe(
      "This file is 3.4GB — source files can be up to 3GB. Compress it, or add it as a Google Drive link instead.",
    );
  });
  it("still refuses non-media files first", () => {
    expect(checkSourceFile(fakeFile("text/html", 1))).toMatch(/must be/);
  });
});

describe("file types when the browser doesn't say (e.g. .mov on Windows Chrome)", () => {
  const f = (name: string, type: string, size = 1000) => ({ name, type, size }) as File;
  it("falls back to the extension", async () => {
    const { fileContentType, checkMediaFile, checkCoverFile, VIDEO_ACCEPT } = await import("./upload-rules");
    expect(fileContentType(f("clip.MOV", ""))).toBe("video/quicktime");
    expect(fileContentType(f("clip.mp4", "application/octet-stream"))).toBe("video/mp4");
    expect(fileContentType(f("photo.jpg", "image/jpg"))).toBe("image/jpeg");
    expect(fileContentType(f("clip.mkv", ""))).toBe("");
    expect(checkMediaFile(f("clip.mov", ""), "video")).toBeNull();
    expect(checkCoverFile(f("cover.webp", ""))).toBeNull();
    expect(checkMediaFile(f("clip.mkv", ""), "video")).toMatch(/MP4, MOV or WebM/);
    // The picker lists extensions too, so Windows doesn't hide .mov files.
    expect(VIDEO_ACCEPT).toContain(".mov");
  });

  it("stays under R2's single-upload ceiling", async () => {
    const { checkMediaFile } = await import("./upload-rules");
    expect(checkMediaFile(f("big.mp4", "video/mp4", 4.8 * 1024 ** 3), "video")).toBeNull();
    expect(checkMediaFile(f("big.mp4", "video/mp4", 5 * 1024 ** 3), "video")).toMatch(/max is 4.9GB/);
  });
});

