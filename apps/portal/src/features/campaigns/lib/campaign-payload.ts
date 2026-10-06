import {
  parseReferenceAssetsFromApi,
  toApiReferenceAssets,
  type ReferenceAsset,
} from "@/features/campaigns/lib/reference-assets";
import { parseRulePoints } from "@/features/campaigns/lib/rule-points";
import { startDateProblem } from "@/features/campaigns/lib/start-date";
import { toApiSourceAssets } from "@/features/campaigns/lib/source-assets";
import type { Campaign } from "@/lib/api";
import type { CampaignDraft } from "@/providers/campaign-wizard";

export type CampaignWizardDraft = CampaignDraft & {
  campaignId: string | null;
};

/** Smallest max payout per creator the API accepts at publish (₹1,000). */
export const MIN_MAX_PAYOUT_RUPEES = 1_000;
/** Largest amount the API accepts for any money field (₹2 crore). */
export const MAX_AMOUNT_RUPEES = 20_000_000;

/** Parses a rupee amount typed into a number field. Returns null for empty,
 * non-numeric, zero/negative or over-the-limit input — never a fallback. */
export function parseRupees(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const rupees = Number(trimmed);
  if (!Number.isFinite(rupees) || rupees <= 0 || rupees > MAX_AMOUNT_RUPEES) return null;
  return rupees;
}

/** Whole paise for the API, or undefined (field omitted) when invalid. */
export function rupeesToPaise(value: string): number | undefined {
  const rupees = parseRupees(value);
  if (rupees === null) return undefined;
  const paise = Math.round(rupees * 100);
  return paise >= 1 ? paise : undefined;
}

export type MoneyFieldErrors = {
  rate: string | null;
  maxPayout: string | null;
  budget: string | null;
};

/** The Budget step's rules, shared with Review so they can't drift. */
export function validateMoneyFields(draft: Pick<CampaignDraft, "ratePer1kRupees" | "maxPayoutRupees" | "budgetRupees">): MoneyFieldErrors {
  const tooBig = `Must be ₹${MAX_AMOUNT_RUPEES.toLocaleString("en-IN")} or less.`;
  const describe = (raw: string, min: number, minMessage: string): string | null => {
    if (!raw.trim()) return "Required.";
    const n = Number(raw.trim());
    if (!Number.isFinite(n)) return "Enter a number.";
    if (n > MAX_AMOUNT_RUPEES) return tooBig;
    if (n < min || n <= 0) return minMessage;
    return null;
  };
  const rate = describe(draft.ratePer1kRupees, 0.01, "Enter a rate greater than ₹0.");
  const maxPayout = describe(draft.maxPayoutRupees, MIN_MAX_PAYOUT_RUPEES, "Must be at least ₹1,000.");
  let budget = describe(draft.budgetRupees, 0.01, "Enter a budget greater than ₹0.");
  if (!budget && !maxPayout && Number(draft.budgetRupees) < Number(draft.maxPayoutRupees)) {
    budget = `Budget must be at least the max payout per creator (₹${Number(draft.maxPayoutRupees).toLocaleString("en-IN")}).`;
  }
  return { rate, maxPayout, budget };
}

export function composeCampaignBrief(draft: CampaignDraft): string {
  return [
    draft.briefHook && `HOOK:\n${draft.briefHook}`,
    draft.doRules && `\n\nDO:\n${draft.doRules}`,
    draft.avoidRules && `\n\nAVOID:\n${draft.avoidRules}`,
  ]
    .filter(Boolean)
    .join("");
}

export function hasInvalidReferenceAssets(assets: ReferenceAsset[]): boolean {
  return assets.some(
    (asset) =>
      (asset.type === "image" || asset.type === "video") &&
      asset.url.trim().length === 0,
  );
}

/**
 * Same completeness rules as the Review step's checklist, evaluated directly
 * against a list-view Campaign (no wizard draft needed) — used to lock
 * "Set live" for drafts that haven't been fully filled out yet.
 */
export function isCampaignReadyToPublish(campaign: Campaign): boolean {
  const hasTitle = campaign.title.trim().length > 0;
  const hasPlatform = campaign.platforms.length > 0;
  const hasValidLocation =
    campaign.locationType === "pan_india" || campaign.targetStates.length > 0;
  const hasBriefHook = (campaign.briefHook ?? "").trim().length > 0;
  const referenceAssets = parseReferenceAssetsFromApi(campaign.referenceAssets);
  const hasValidAssets = !hasInvalidReferenceAssets(referenceAssets);
  const budgetValid =
    campaign.ratePer1kPaise > 0 &&
    campaign.maxPayoutPaise >= MIN_MAX_PAYOUT_RUPEES * 100 &&
    campaign.budgetPaise >= campaign.maxPayoutPaise;
  // Same content rules the API enforces on a first publish.
  const hasDoPoints = parseRulePoints(campaign.doRules ?? "").length > 0;
  const hasAvoidPoints = parseRulePoints(campaign.avoidRules ?? "").length > 0;
  const hasSourceAsset = (campaign.sourceAssets ?? []).some((a) => a.url.trim().length > 0);
  // The "Set live" button on the list is for drafts, which can't start in the past.
  const startDay = campaign.startDate ? campaign.startDate.slice(0, 10) : "";
  const hasValidStartDate = Boolean(startDay) && !startDateProblem(startDay);

  return (
    hasTitle &&
    hasPlatform &&
    hasValidLocation &&
    hasBriefHook &&
    hasDoPoints &&
    hasAvoidPoints &&
    hasSourceAsset &&
    hasValidStartDate &&
    hasValidAssets &&
    budgetValid
  );
}

export function buildCampaignBody(
  draft: CampaignDraft,
  status: "draft" | "live" | "paused" | "closed",
  brandProfileId?: string | null,
): Record<string, unknown> {
  const referenceAssets = toApiReferenceAssets(draft.referenceAssets);
  const sourceAssets = toApiSourceAssets(draft.sourceAssets);
  const brief = composeCampaignBrief(draft);
  const platforms = draft.platforms.length > 0 ? draft.platforms.slice(0, 1) : ["instagram_reel"];

  const effectiveBrandProfileId = brandProfileId ?? draft.brandProfileId;

  return {
    ...(effectiveBrandProfileId ? { brandProfileId: effectiveBrandProfileId } : {}),
    title: draft.title.trim(),
    status,
    category: draft.category || undefined,
    platforms,
    locationType: draft.locationType,
    targetStates: draft.locationType === "states" ? draft.targetStates : [],
    // A draft's past/invalid start date isn't sent (the field shows why), so
    // it can't make the server refuse the whole save and block other edits.
    startDate:
      draft.startDate && !(draft.status === "draft" && startDateProblem(draft.startDate))
        ? draft.startDate
        : undefined,
    briefHook: draft.briefHook || undefined,
    doRules: draft.doRules || undefined,
    avoidRules: draft.avoidRules || undefined,
    sourceAssets: sourceAssets.length > 0 ? sourceAssets : undefined,
    sourceVideoRequirement: draft.sourceVideoRequirement,
    sourceAudioRequirement: draft.sourceAudioRequirement,
    referenceAssets: referenceAssets.length > 0 ? referenceAssets : undefined,
    coverImageUrl: draft.coverImageUrl || undefined,
    brief: brief || undefined,
    productUrl: draft.productUrl || undefined,
    // An empty or invalid amount is left out (the server keeps its current
    // value) instead of silently becoming a default — the Budget step shows
    // the field error and blocks Next/Publish until it's fixed.
    ratePer1kPaise: rupeesToPaise(draft.ratePer1kRupees),
    maxPayoutPaise: rupeesToPaise(draft.maxPayoutRupees),
    budgetPaise: rupeesToPaise(draft.budgetRupees),
  };
}
