import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api";
import { signInErrorMessage } from "./sign-in-error";

describe("signInErrorMessage", () => {
  it("shows the lockout message with its wait time", () => {
    const err = new ApiError("RATE_LIMITED", "Too many failed sign-in attempts. Try again in 15 minutes.", 429);
    expect(signInErrorMessage(err)).toBe("Too many failed sign-in attempts. Try again in 15 minutes.");
  });
  it("explains a generic rate limit", () => {
    expect(signInErrorMessage(new ApiError("RATE_LIMITED", "ThrottlerException: Too Many Requests", 429))).toBe(
      "Too many attempts. Wait a minute, then try again.",
    );
  });
  it("passes a wrong-password answer through unchanged", () => {
    expect(signInErrorMessage(new ApiError("UNAUTHORIZED", "Invalid email or password", 401))).toBe("Invalid email or password");
  });
  it("says so when the server couldn't be reached", () => {
    expect(signInErrorMessage(new ApiError("NETWORK", "Failed to fetch"))).toMatch(/Couldn't reach the server/);
  });
});
