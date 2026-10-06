import { describe, expect, it } from "vitest";

import { campaignStatusLabel, isLockedForReview } from "@/features/campaigns/lib/campaign-status";
import type { Campaign } from "@/lib/api";
import { getCampaignMenuActions } from "./campaign-row-actions";

const ready = {
  id: "c1",
  title: "Summer",
  status: "draft",
  platforms: ["instagram_reel"],
  locationType: "pan_india",
  targetStates: [],
  briefHook: "Hook",
  doRules: "Do this",
  avoidRules: "Avoid that",
  sourceAssets: [{ type: "drive", url: "https://drive.google.com/x" }],
  referenceAssets: [],
  ratePer1kPaise: 5000,
  maxPayoutPaise: 5_000_000,
  budgetPaise: 10_000_000,
  startDate: `${new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}T00:00:00.000Z`,
} as unknown as Campaign;

const statuses = (c: Campaign, isAdmin: boolean) =>
  getCampaignMenuActions(c, isAdmin).map((a) => (a.kind === "status" ? a.status : a.kind));

describe("campaign menu: approval", () => {
  it("a brand's draft offers 'Submit for approval', never 'Set live'", () => {
    const actions = getCampaignMenuActions(ready, false);
    expect(statuses(ready, false)).toContain("pending_review");
    expect(statuses(ready, false)).not.toContain("live");
    expect(actions[0]).toMatchObject({ label: "Submit for approval", disabled: false });
  });

  it("an admin's draft still offers 'Set live'", () => {
    expect(statuses(ready, true)).toContain("live");
    expect(statuses(ready, true)).not.toContain("pending_review");
  });

  it("an incomplete draft can't be submitted", () => {
    const incomplete = { ...ready, sourceAssets: [] } as Campaign;
    expect(getCampaignMenuActions(incomplete, false)[0]).toMatchObject({ status: "pending_review", disabled: true });
  });

  it("waiting: the brand can only withdraw; nothing else (no live, no delete)", () => {
    const waiting = { ...ready, status: "pending_review" } as Campaign;
    expect(statuses(waiting, false)).toEqual(["draft"]);
    expect(statuses(waiting, true)).toEqual([]); // admin reviews from the campaign page
  });
});

describe("campaign status helpers", () => {
  it("labels and locking", () => {
    expect(campaignStatusLabel("pending_review")).toBe("awaiting approval");
    expect(campaignStatusLabel("live")).toBe("live");
    expect(isLockedForReview("pending_review", false)).toBe(true);
    expect(isLockedForReview("pending_review", true)).toBe(false);
    expect(isLockedForReview("draft", false)).toBe(false);
  });
});
