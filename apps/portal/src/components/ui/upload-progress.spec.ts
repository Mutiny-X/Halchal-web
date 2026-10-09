import { describe, expect, it } from "vitest";

import { timeLeft, uploadDetail } from "./upload-progress";

describe("upload progress text", () => {
  it("size, speed and time left", () => {
    expect(uploadDetail({ phase: "uploading", loaded: 48 * 1024 ** 2, total: 320 * 1024 ** 2, percent: 15, bytesPerSecond: 4.2 * 1024 ** 2, secondsLeft: 65 })).toBe(
      "48.0 MB of 320 MB · 4.2 MB/s · ~1 min left",
    );
    expect(uploadDetail({ phase: "uploading", loaded: 1.5 * 1024 ** 3, total: 3 * 1024 ** 3, percent: 50, bytesPerSecond: null, secondsLeft: null })).toBe("1.50 GB of 3.00 GB");
    expect(uploadDetail({ phase: "checking" })).toBe("Checking the file…");
    expect(timeLeft(3)).toBe("a few seconds left");
    expect(timeLeft(42)).toBe("42s left");
    expect(timeLeft(3 * 3600 + 600)).toBe("~3 h 10 min left");
  });
});
