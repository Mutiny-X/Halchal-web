import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath (post-sign-in redirect stays inside the portal)", () => {
  it.each(["/admin/campaigns", "/staff/brands/abc?tab=work", "/campaigns/123#top"])("keeps an in-app path: %s", (ok) => {
    expect(safeRedirectPath(ok)).toBe(ok);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/%2F/evil.example",
    "%2F%2Fevil.example",
    "javascript:alert(1)",
    "data:text/html,hi",
    "evil.example",
    "/\\evil.example",
    "/\\/evil.example",
    "%2F%5Cevil.example",
    "/\t/evil.example",
    "/\n/evil.example",
  ])("sends %j to the sign-in page instead", (bad) => {
    expect(safeRedirectPath(bad)).toBe("/login");
  });

  it("doesn't crash on a malformed address", () => {
    expect(safeRedirectPath("/%E0%A4%A")).toBe("/login");
  });

  it("falls back when nothing is given", () => {
    expect(safeRedirectPath(undefined)).toBe("/login");
    expect(safeRedirectPath(null)).toBe("/login");
    expect(safeRedirectPath("")).toBe("/login");
  });
});
