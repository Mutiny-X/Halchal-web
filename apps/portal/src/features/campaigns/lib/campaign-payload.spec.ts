import { describe, expect, it } from "vitest";

import type { Campaign } from "@/lib/api";
import type { CampaignDraft } from "@/providers/campaign-wizard";
import {
  buildCampaignBody,
  isCampaignReadyToPublish,
  parseRupees,
  rupeesToPaise,
  validateMoneyFields,
} from "./campaign-payload";

const baseDraft: CampaignDraft = {
  campaignId: null,
  status: "draft",
  wizardStep: "basics",
  brandProfileId: null,
  coverImageUrl: "",
  title: "Summer drop",
  category: "",
  platforms: ["instagram_reel"],
  locationType: "pan_india",
  targetStates: [],
  startDate: "",
  briefHook: "",
  doRules: "",
  avoidRules: "",
  sourceAssets: [],
  sourceVideoRequirement: "mandatory",
  sourceAudioRequirement: "not_required",
  referenceAssets: [],
  brief: "",
  productUrl: "",
  ratePer1kRupees: "50",
  maxPayoutRupees: "50000",
  budgetRupees: "100000",
};

describe("money parsing", () => {
  it.each([
    ["50", 5000],
    [" 50 ", 5000],
    ["50.5", 5050],
    ["0.01", 1],
  ])("%j rupees → %i paise", (raw, paise) => {
    expect(rupeesToPaise(raw)).toBe(paise);
  });

  it.each(["", "  ", "abc", "0", "-5", "NaN", "Infinity", "20000001", "0.001"])(
    "%j is rejected, never turned into a default",
    (raw) => {
      expect(rupeesToPaise(raw)).toBeUndefined();
    },
  );

  it("parseRupees caps at ₹2 crore", () => {
    expect(parseRupees("20000000")).toBe(20_000_000);
    expect(parseRupees("20000000.01")).toBeNull();
  });
});

describe("buildCampaignBody", () => {
  it("omits a cleared money field instead of sending ₹50 / ₹50,000 / ₹1,00,000", () => {
    const body = buildCampaignBody({ ...baseDraft, ratePer1kRupees: "", maxPayoutRupees: "abc", budgetRupees: "0" }, "draft");
    expect(body.ratePer1kPaise).toBeUndefined();
    expect(body.maxPayoutPaise).toBeUndefined();
    expect(body.budgetPaise).toBeUndefined();
    // JSON.stringify drops undefined, so the server keeps its stored value.
    expect(JSON.parse(JSON.stringify(body))).not.toHaveProperty("budgetPaise");
  });

  it("leaves a past start date out of a draft's save, so other edits still save", () => {
    expect(buildCampaignBody({ ...baseDraft, startDate: "2020-01-01" }, "draft").startDate).toBeUndefined();
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    expect(buildCampaignBody({ ...baseDraft, startDate: future }, "draft").startDate).toBe(future);
    // A live campaign keeps sending its real (past) start date unchanged.
    expect(buildCampaignBody({ ...baseDraft, status: "live", startDate: "2020-01-01" }, "live").startDate).toBe("2020-01-01");
  });

  it("sends whole paise for valid amounts", () => {
    const body = buildCampaignBody(baseDraft, "draft");
    expect(body).toMatchObject({ ratePer1kPaise: 5000, maxPayoutPaise: 5_000_000, budgetPaise: 10_000_000 });
  });
});

describe("validateMoneyFields", () => {
  it("accepts the defaults", () => {
    expect(validateMoneyFields(baseDraft)).toEqual({ rate: null, maxPayout: null, budget: null });
  });

  it("explains each problem", () => {
    expect(validateMoneyFields({ ...baseDraft, ratePer1kRupees: "" }).rate).toBe("Required.");
    expect(validateMoneyFields({ ...baseDraft, ratePer1kRupees: "x" }).rate).toBe("Enter a number.");
    expect(validateMoneyFields({ ...baseDraft, maxPayoutRupees: "999" }).maxPayout).toBe("Must be at least ₹1,000.");
    expect(validateMoneyFields({ ...baseDraft, budgetRupees: "30000000" }).budget).toMatch(/or less/);
    expect(validateMoneyFields({ ...baseDraft, budgetRupees: "40000" }).budget).toMatch(/at least the max payout/);
  });
});

describe("isCampaignReadyToPublish (list 'Set live' button)", () => {
  const ready = {
    title: "Summer",
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

  it("is true only when the server's publish rules would pass", () => {
    expect(isCampaignReadyToPublish(ready)).toBe(true);
    expect(isCampaignReadyToPublish({ ...ready, doRules: " - " })).toBe(false);
    expect(isCampaignReadyToPublish({ ...ready, avoidRules: null })).toBe(false);
    expect(isCampaignReadyToPublish({ ...ready, sourceAssets: [] })).toBe(false);
    expect(isCampaignReadyToPublish({ ...ready, budgetPaise: 4_000_000 })).toBe(false);
    expect(isCampaignReadyToPublish({ ...ready, startDate: null })).toBe(false);
    expect(isCampaignReadyToPublish({ ...ready, startDate: "2020-01-01T00:00:00.000Z" })).toBe(false);
  });
});
