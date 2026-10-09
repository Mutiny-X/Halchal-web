import { describe, expect, it } from "vitest";

import { isOnDomain } from "./link-host";

describe("isOnDomain", () => {
  it("accepts the domain and its subdomains", () => {
    expect(isOnDomain("https://instagram.com/reel/x", "instagram.com")).toBe(true);
    expect(isOnDomain("https://www.instagram.com/reel/x", "instagram.com")).toBe(true);
    expect(isOnDomain("https://youtu.be/abc", "youtube.com", "youtu.be")).toBe(true);
  });

  it.each([
    "https://instagram.com.evil.example/reel/x",
    "https://evil.example/?u=instagram.com",
    "https://evil-instagram.com/reel/x",
    "javascript:alert('instagram.com')",
    "not a link",
  ])("refuses the look-alike %s", (bad) => {
    expect(isOnDomain(bad, "instagram.com")).toBe(false);
  });
});
