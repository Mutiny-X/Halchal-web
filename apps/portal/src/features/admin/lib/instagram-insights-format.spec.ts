import { describe, expect, it } from "vitest";

import type { InstagramAccountInsights } from "@/lib/api";
import {
  countryName,
  formatLabel,
  percent,
  sortAges,
  summarySentence,
  timeAgo,
  topPostsByKind,
  unavailableTitle,
  watchTime,
  withShares,
} from "./instagram-insights-format";

describe("instagram insights formatting", () => {
  it("shares and labels", () => {
    expect(withShares([{ key: "STORY", value: 701 }, { key: "POST", value: 299 }], formatLabel)).toEqual([
      { key: "STORY", label: "Stories", value: 701, share: 70.1 },
      { key: "POST", label: "Feed posts", value: 299, share: 29.9 },
    ]);
    expect(withShares(null)).toEqual([]);
    expect(countryName("IN")).toBe("India");
    expect(sortAges([{ key: "65+", value: 1 }, { key: "18-24", value: 9 }, { key: "13-17", value: 2 }]).map((r) => r.key)).toEqual(["13-17", "18-24", "65+"]);
    expect(percent(83, 326)).toBe(25.46);
    expect(percent(5, 0)).toBeNull();
    expect(unavailableTitle("followers_city")).toBe("Follower city");
    expect(unavailableTitle("post_insights")).toBe("Per-post insights");
    expect(watchTime(4200)).toBe("4s");
    expect(watchTime(75_000)).toBe("1m 15s");
    expect(timeAgo(new Date(Date.now() - 8 * 60000).toISOString())).toBe("8 min ago");
  });

  it("summary sentence and top posts", () => {
    const report = {
      period: { days: 30 },
      overview: { totals: { reach: 326, accountsEngaged: 83 } },
      audience: { followers: { country: [{ key: "IN", value: 300 }], age: [{ key: "18-24", value: 190 }] } },
    } as unknown as InstagramAccountInsights;
    expect(summarySentence(report)).toBe(
      "In the last 30 days this creator's content reached 326 accounts, and 83 of them interacted (25.46%). Most followers are in India, aged 18-24.",
    );
    const post = (id: string, kind: "reel" | "carousel", metrics: object) =>
      ({ id, kind, metrics, permalink: null, caption: null, thumbnailUrl: null, timestamp: null, childCount: null, engagementByReach: null });
    const groups = topPostsByKind([
      post("a", "reel", { totalInteractions: 5 }),
      post("b", "reel", { totalInteractions: 50 }),
      post("c", "carousel", { reach: 10 }),
    ]);
    expect(groups.map((g) => [g.kind, g.posts.map((p) => p.id)])).toEqual([["reel", ["b", "a"]], ["carousel", ["c"]]]);
  });
});
