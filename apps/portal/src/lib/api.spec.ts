import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch, apiFetchPublic, registerApiAuthHandlers } from "./api";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const html = (status: number) => new Response("<html>502 Bad Gateway</html>", { status, headers: { "Content-Type": "text/html" } });
const unauthorized = () => json(401, { success: false, data: null, error: { code: "UNAUTHORIZED", message: "Unauthorized" } });
const session = { tokens: { accessToken: "new-access", refreshToken: "new-refresh", expiresIn: "15m" }, user: { id: "u1", role: "brand", email: null, phone: null, displayName: null } };

describe("API client session handling (item 11)", () => {
  let handlers: { getRefreshToken: ReturnType<typeof vi.fn>; onSessionRefreshed: ReturnType<typeof vi.fn>; onSessionExpired: ReturnType<typeof vi.fn> };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    handlers = {
      getRefreshToken: vi.fn(() => "refresh-1"),
      onSessionRefreshed: vi.fn(),
      onSessionExpired: vi.fn(),
    };
    registerApiAuthHandlers(handlers as never);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const isRefresh = (url: string) => url.endsWith("/auth/refresh");

  it("refreshes and retries with the new token", async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (isRefresh(url)) return json(200, { success: true, data: session, error: null });
      const auth = new Headers(init.headers).get("Authorization");
      return auth === "Bearer new-access" ? json(200, { success: true, data: { ok: 1 }, error: null }) : unauthorized();
    });
    await expect(apiFetch("/campaigns/1", { accessToken: "old" })).resolves.toEqual({ ok: 1 });
    expect(handlers.onSessionRefreshed).toHaveBeenCalledWith(session);
    expect(handlers.onSessionExpired).not.toHaveBeenCalled();
  });

  it.each([
    ["the network drops during refresh", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["refresh hits a 502 proxy page", () => Promise.resolve(html(502))],
    ["refresh returns a JSON 500", () => Promise.resolve(json(500, { success: false, data: null, error: { code: "INTERNAL_ERROR", message: "x" } }))],
    ["refresh is rate-limited (429)", () => Promise.resolve(json(429, { success: false, data: null, error: { code: "RATE_LIMITED", message: "slow down" } }))],
  ])("stays signed in when %s", async (_label, refreshReply) => {
    fetchMock.mockImplementation((url: string) => (isRefresh(url) ? refreshReply() : Promise.resolve(unauthorized())));
    const err = await apiFetch("/campaigns/1", { accessToken: "old" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.message).toMatch(/still signed in/);
    expect(handlers.onSessionExpired).not.toHaveBeenCalled();
  });

  it("signs out only when the server really refuses the refresh token", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      isRefresh(url) ? json(401, { success: false, data: null, error: { code: "UNAUTHORIZED", message: "Invalid refresh token" } }) : unauthorized(),
    );
    const err = await apiFetch("/campaigns/1", { accessToken: "old" }).catch((e) => e);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(handlers.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("makes ONE refresh call for many requests that 401 at once", async () => {
    let refreshCalls = 0;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (isRefresh(url)) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 10));
        return json(200, { success: true, data: session, error: null });
      }
      return new Headers(init.headers).get("Authorization") === "Bearer new-access"
        ? json(200, { success: true, data: 1, error: null })
        : unauthorized();
    });
    await Promise.all([1, 2, 3].map(() => apiFetch("/x", { accessToken: "old" })));
    expect(refreshCalls).toBe(1);
  });
});

describe("API client error shapes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("a non-JSON 502 becomes a readable SERVER_UNAVAILABLE error, not a JSON parse crash", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(html(502)));
    const err = await apiFetchPublic("/public/campaigns/1").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("SERVER_UNAVAILABLE");
    expect(err.status).toBe(502);
  });

  it("no network becomes NETWORK_ERROR", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const err = await apiFetch("/x").catch((e) => e);
    expect(err.code).toBe("NETWORK_ERROR");
  });

  it("server error envelopes keep their code and message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(400, { success: false, data: null, error: { code: "VALIDATION_ERROR", message: "Add at least one 'Do' point" } })));
    const err = await apiFetch("/x").catch((e) => e);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Add at least one 'Do' point");
    expect(err.status).toBe(400);
  });
});
