import { describe, expect, it } from "vitest";

import { sourceLinkProblem } from "./source-assets";

describe("sourceLinkProblem (item 15, mirrors the API)", () => {
  it.each([
    ["drive", "https://drive.google.com/file/d/abc/view"],
    ["drive", "https://docs.google.com/uc?id=abc"],
    ["youtube", "https://www.youtube.com/watch?v=abc"],
    ["youtube", "https://youtu.be/abc"],
    ["youtube", "https://m.youtube.com/shorts/abc"],
    ["upload", "anything — uploads come from our own upload"],
    ["drive", ""],
  ] as const)("accepts %s %j", (type, url) => {
    expect(sourceLinkProblem(type, url)).toBeNull();
  });

  it.each([
    ["drive", "drive.google.com/file/d/abc", /starting with https/],
    ["drive", "https://dropbox.com/s/abc", /Google Drive/],
    ["drive", "https://drive.google.com.evil.com/file/d/abc", /Google Drive/],
    ["drive", "javascript:alert(1)", /starting with https/],
    ["youtube", "https://vimeo.com/123", /YouTube/],
    ["youtube", "https://youtube.com.evil.com/watch", /YouTube/],
    ["drive", "http://169.254.169.254/latest/meta-data", /Google Drive/],
  ] as const)("rejects %s %j", (type, url, message) => {
    expect(sourceLinkProblem(type, url)).toMatch(message);
  });
});
