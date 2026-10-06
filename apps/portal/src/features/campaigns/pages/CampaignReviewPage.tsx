import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Eye,
  HardDrive,
  MapPin,
  PlayCircle,
  Rocket,
  Send,
  ShieldCheck,
  Undo2,
  Upload,
  UserPlus,
  Youtube,
} from "lucide-react";

import { StatusPill } from "@/components/ui/status-pill";
import { RejectCampaignDialog } from "@/features/campaigns/components/reject-campaign-dialog";
import { useToast } from "@/components/ui/toaster";
import {
  CampaignWizardFooter,
  CampaignWizardHeader,
  WizardPage,
} from "@/features/campaigns/components/campaign-wizard-layout";
import {
  MediaPreviewLightbox,
} from "@/features/campaigns/components/reference-assets-editor";
import { WizardStepper } from "@/features/campaigns/components/wizard-stepper";
import { useCampaignDraftSave } from "@/features/campaigns/hooks/use-campaign-draft-save";
import { useWizardBack } from "@/features/campaigns/hooks/use-wizard-back";
import {
  hasInvalidReferenceAssets,
  validateMoneyFields,
} from "@/features/campaigns/lib/campaign-payload";
import { checkoutTotals, formatRupeeAmount, PLATFORM_FEE_RATE } from "@/features/campaigns/lib/pricing";
import type { ReferenceAsset } from "@/features/campaigns/lib/reference-assets";
import type { SourceAssetType } from "@/features/campaigns/lib/source-assets";
import { startDateProblem } from "@/features/campaigns/lib/start-date";
import {
  estimateMinClippersNeeded,
  estimateViewsFromBudget,
  formatEstimatedViews,
} from "@/features/campaigns/lib/estimate-views";
import { getPlatformOption } from "@/features/campaigns/lib/platform-options";
import { parseRulePoints } from "@/features/campaigns/lib/rule-points";
import { cn } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/media-url";
import { usePortalRole } from "@/providers/auth-provider";
import { useCampaignWizard, type CampaignDraft } from "@/providers/campaign-wizard";

function EditLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-semibold text-primary hover:underline"
    >
      Edit
    </button>
  );
}

function ReviewCard({
  title,
  onEdit,
  className,
  children,
}: {
  title: string;
  onEdit: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-surface p-5", className)}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <EditLink onClick={onEdit} />
      </div>
      {children}
    </div>
  );
}

const SOURCE_TYPE_META: Record<SourceAssetType, { label: string; icon: typeof HardDrive }> = {
  drive: { label: "Google Drive link", icon: HardDrive },
  youtube: { label: "YouTube link", icon: Youtube },
  upload: { label: "Uploaded file", icon: Upload },
};

const REQUIREMENT_LABEL: Record<CampaignDraft["sourceVideoRequirement"], string> = {
  mandatory: "Mandatory",
  optional: "Optional",
  not_required: "Not required",
};

/** "2026-10-07" → "Wed, 7 Oct 2026" (the day as picked, no timezone shift). */
function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Missing({ text = "Not set" }: { text?: string }) {
  return <span className="font-medium text-warning">{text}</span>;
}

function DetailRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function RuleList({ title, tone, points }: { title: string; tone: "do" | "avoid"; points: string[] }) {
  return (
    <div>
      <p className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", tone === "do" ? "text-money" : "text-destructive")}>
        {title} ({points.length})
      </p>
      {points.length > 0 ? (
        <ol className="space-y-1.5 text-sm text-foreground">
          {points.map((point, i) => (
            <li key={`${i}-${point}`} className="flex gap-2">
              <span className={cn("w-4 shrink-0 text-right text-xs font-semibold leading-5", tone === "do" ? "text-money" : "text-destructive")}>
                {i + 1}.
              </span>
              <span className="min-w-0 break-words">{point}</span>
            </li>
          ))}
        </ol>
      ) : (
        <Missing />
      )}
    </div>
  );
}

export function CampaignReviewPage() {
  const navigate = useNavigate();
  const { goBack, backLabel } = useWizardBack();
  const role = usePortalRole();
  const isAdmin = role === "admin";
  const { draft, paths, autoSave, dirty, locked, requestSaveLiveChanges } = useCampaignWizard();
  // Admins publish (or approve) directly; brands and staff submit for approval.
  const reviewingSubmission = isAdmin && draft.status === "pending_review";
  const [rejectOpen, setRejectOpen] = useState(false);
  const { toast } = useToast();
  const { publishWithFeedback, saving } = useCampaignDraftSave();
  const [previewAsset, setPreviewAsset] = useState<ReferenceAsset | null>(null);

  const invalidAssets = hasInvalidReferenceAssets(draft.referenceAssets);
  const doPoints = useMemo(() => parseRulePoints(draft.doRules), [draft.doRules]);
  const avoidPoints = useMemo(
    () => parseRulePoints(draft.avoidRules),
    [draft.avoidRules],
  );
  const rate = Number(draft.ratePer1kRupees);
  const maxPayout = Number(draft.maxPayoutRupees);
  const budget = Number(draft.budgetRupees);
  // NOT fee-adjusted: CampaignPayoutPage already charges the platform fee
  // on top of this budget at checkout (totalCheckout = budget + fee), so
  // the full budget the brand types in is what's actually payable to
  // clippers — deducting the fee again here would double-count it.
  const estimatedViews = estimateViewsFromBudget(budget, rate);
  const minClippersNeeded = estimateMinClippersNeeded(budget, maxPayout);
  const moneyErrors = validateMoneyFields(draft);
  const budgetValid = !moneyErrors.rate && !moneyErrors.maxPayout && !moneyErrors.budget;
  const hasSourceAsset = draft.sourceAssets.some((a) => a.url.trim().length > 0);
  const { platformFee, total: checkoutTotal } = checkoutTotals(budget);

  const checklist = [
    { label: "Campaign name", ok: draft.title.trim().length > 0, path: paths.basics },
    {
      label: "Start date (today or later)",
      ok: Boolean(draft.startDate) && (draft.status !== "draft" || !startDateProblem(draft.startDate)),
      path: paths.basics,
    },
    { label: "Target platform selected", ok: draft.platforms.length > 0, path: paths.basics },
    {
      label: "Target location set",
      ok: draft.locationType === "pan_india" || draft.targetStates.length > 0,
      path: paths.basics,
    },
    { label: "Creative brief written", ok: draft.briefHook.trim().length > 0, path: paths.brief },
    { label: "Do & Avoid points added", ok: doPoints.length > 0 && avoidPoints.length > 0, path: paths.brief },
    { label: "Source assets added", ok: hasSourceAsset, path: paths.brief },
    { label: "Sample content uploaded", ok: !invalidAssets, path: paths.brief },
    { label: "Budget & payout configured", ok: budgetValid, path: paths.payout },
  ];
  const readyToPublish = checklist.every((item) => item.ok);
  const platformOption = getPlatformOption(draft.platforms[0] ?? "");

  async function onPublish() {
    await publishWithFeedback(toast);
  }

  return (
    <>
      <WizardStepper />
      <WizardPage>
        <div className="pb-24">
          <CampaignWizardHeader
            title="Review your Campaign"
            subtitle={
              reviewingSubmission
                ? "Check everything, then approve it to go live, or send it back to the brand with a reason."
                : isAdmin
                  ? "Check all campaign details before publishing to creators."
                  : "Check all campaign details, then submit it. An admin approves it before creators can see it."
            }
            onBack={goBack}
          />

          <div className="space-y-6">
            {/* ── Publish readiness ── */}
            <div
              className={cn(
                "rounded-2xl border p-5",
                readyToPublish
                  ? "border-money/30 bg-money/[0.04]"
                  : "border-warning/30 bg-warning/[0.04]",
              )}
            >
              <div className="flex items-center gap-2">
                {readyToPublish ? (
                  <Check className="h-4 w-4 text-money" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-warning" />
                )}
                <p className="text-sm font-semibold text-foreground">
                  {readyToPublish
                    ? isAdmin
                      ? "Ready to publish"
                      : "Ready to submit for approval"
                    : isAdmin
                      ? "Before you publish"
                      : "Before you submit"}
                </p>
              </div>
              <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {checklist.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => navigate(item.path)}
                    disabled={item.ok}
                    className="flex items-center gap-2 rounded-lg py-1 text-left text-sm disabled:cursor-default"
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                        item.ok ? "bg-money/15 text-money" : "bg-warning/15 text-warning",
                      )}
                    >
                      {item.ok ? (
                        <Check className="h-3 w-3" strokeWidth={3} />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                    </span>
                    <span className={item.ok ? "text-muted" : "font-medium text-foreground"}>
                      {item.label}
                    </span>
                    {!item.ok && <span className="text-xs text-primary">Fix →</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* ── 1. Overview ── */}
            <ReviewCard title="Overview" onEdit={() => navigate(paths.basics)}>
              <div className="grid gap-5 sm:grid-cols-[260px_1fr]">
                {draft.coverImageUrl ? (
                  <img
                    src={resolveMediaUrl(draft.coverImageUrl)}
                    alt="Campaign cover"
                    className="aspect-video w-full rounded-xl border border-border object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted">
                    No cover image
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold text-foreground">{draft.title.trim() || "Untitled campaign"}</p>
                    <StatusPill status={draft.status} />
                  </div>
                  <dl className="mt-3 divide-y divide-border">
                    <DetailRow label="Category" value={draft.category || <Missing />} />
                    <DetailRow
                      label="Platform"
                      value={
                        platformOption ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn("flex h-4 w-4 items-center justify-center rounded-full text-white", platformOption.badge)}>
                              <platformOption.icon className="h-2.5 w-2.5" />
                            </span>
                            {platformOption.label}
                          </span>
                        ) : (
                          <Missing />
                        )
                      }
                    />
                    <DetailRow label="Start date" value={draft.startDate ? formatDay(draft.startDate) : <Missing />} />
                    <DetailRow
                      label="Location"
                      value={
                        draft.locationType === "pan_india" ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-muted" /> Pan India
                          </span>
                        ) : draft.targetStates.length > 0 ? (
                          <span className="flex flex-wrap justify-end gap-1.5">
                            {draft.targetStates.map((state) => (
                              <span key={state} className="rounded-full bg-surface-variant px-2 py-0.5 text-xs font-medium">
                                {state}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <Missing />
                        )
                      }
                    />
                    {role !== "brand" && (
                      <DetailRow
                        label="Brand"
                        value={draft.brandCompanyName || (draft.brandProfileId ? "Assigned" : <Missing text="Not assigned yet" />)}
                      />
                    )}
                  </dl>
                </div>
              </div>
            </ReviewCard>

            {/* ── 2. Budget & payouts ── */}
            <ReviewCard title="Budget & payouts" onEdit={() => navigate(paths.payout)}>
              <div className="grid gap-5 sm:grid-cols-[1fr_260px]">
                <dl className="divide-y divide-border">
                  <DetailRow label="Rate" value={moneyErrors.rate ? <Missing text={moneyErrors.rate} /> : `${formatRupeeAmount(rate)} per 1,000 views`} />
                  <DetailRow label="Max payout per creator" value={moneyErrors.maxPayout ? <Missing text={moneyErrors.maxPayout} /> : formatRupeeAmount(maxPayout)} />
                  <DetailRow label="Budget pool" value={moneyErrors.budget ? <Missing text={moneyErrors.budget} /> : formatRupeeAmount(budget)} />
                  <DetailRow label={`Platform fee (${PLATFORM_FEE_RATE * 100}%)`} value={budgetValid ? formatRupeeAmount(platformFee) : "—"} />
                  <DetailRow
                    label={<span className="font-semibold text-foreground">Total at checkout</span>}
                    value={<span className="font-bold text-money">{budgetValid ? formatRupeeAmount(checkoutTotal) : "—"}</span>}
                  />
                </dl>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                      <Eye className="h-3.5 w-3.5" />
                      Estimated views
                    </div>
                    <p className="mt-1 font-display text-2xl font-black text-foreground">
                      {budgetValid ? formatEstimatedViews(estimatedViews) : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-variant/40 p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      <UserPlus className="h-3.5 w-3.5" />
                      Min. creators to spend it
                    </div>
                    <p className="mt-1 font-display text-2xl font-black text-foreground">
                      {budgetValid && minClippersNeeded > 0 ? minClippersNeeded.toLocaleString("en-IN") : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </ReviewCard>

            {/* ── 3. Creative brief ── */}
            <ReviewCard title="Creative brief" onEdit={() => navigate(paths.brief)}>
              {draft.briefHook.trim() ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{draft.briefHook.trim()}</p>
              ) : (
                <Missing text="No brief written yet" />
              )}
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <RuleList title="Do this" tone="do" points={doPoints.map((p) => p.text)} />
                <RuleList title="Avoid this" tone="avoid" points={avoidPoints.map((p) => p.text)} />
              </div>
            </ReviewCard>

            {/* ── 4. Source assets ── */}
            <ReviewCard title={`Source assets (${draft.sourceAssets.length})`} onEdit={() => navigate(paths.brief)}>
              {draft.sourceAssets.length === 0 ? (
                <Missing text="No source assets added" />
              ) : (
                <>
                  <ul className="divide-y divide-border">
                    {draft.sourceAssets.map((asset) => {
                      const meta = SOURCE_TYPE_META[asset.type];
                      const href = asset.type === "upload" ? resolveMediaUrl(asset.url) : asset.url;
                      return (
                        <li key={asset.id} className="flex items-center gap-3 py-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-variant text-muted">
                            <meta.icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {asset.label.trim() || meta.label}
                            </p>
                            <p className="truncate text-xs text-muted">
                              {meta.label}
                              {asset.type !== "upload" && asset.url ? ` · ${linkHost(asset.url)}` : ""}
                            </p>
                          </div>
                          {asset.url ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              Open <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <Missing text="Missing link" />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <dl className="mt-3 divide-y divide-border border-t border-border">
                    <DetailRow label="Creators must use this footage" value={REQUIREMENT_LABEL[draft.sourceVideoRequirement]} />
                    <DetailRow label="Creators must use this audio/song" value={REQUIREMENT_LABEL[draft.sourceAudioRequirement]} />
                  </dl>
                </>
              )}
            </ReviewCard>

            {/* ── 5. Sample content ── */}
            <ReviewCard title={`Sample content (${draft.referenceAssets.length})`} onEdit={() => navigate(paths.brief)}>
              {draft.referenceAssets.length === 0 ? (
                <p className="text-sm text-muted">No sample content (optional).</p>
              ) : (
                <>
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {draft.referenceAssets.map((asset) => (
                      <li key={asset.id} className="overflow-hidden rounded-xl border border-border bg-surface">
                        <button
                          type="button"
                          disabled={!asset.url}
                          onClick={() => setPreviewAsset(asset)}
                          aria-label={`Preview ${asset.label || asset.type}`}
                          className="relative block aspect-square w-full bg-surface-variant/40 disabled:cursor-not-allowed"
                        >
                          {asset.url ? (
                            asset.type === "image" ? (
                              <img
                                src={resolveMediaUrl(asset.url)}
                                alt={asset.label || "Sample image"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <>
                                {/* "#t=0.1" makes browsers draw a real first frame instead of black */}
                                <video src={`${resolveMediaUrl(asset.url)}#t=0.1`} muted preload="metadata" playsInline className="h-full w-full object-cover" />
                                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                                  <PlayCircle className="h-7 w-7 text-white drop-shadow" />
                                </span>
                              </>
                            )
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-xs text-destructive">No file</span>
                          )}
                        </button>
                        <div className="px-2.5 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                            {asset.type === "image" ? "Image · Post format" : "Video · Reel format"}
                          </p>
                          <p className="truncate text-xs text-foreground">{asset.label.trim() || "No caption"}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {invalidAssets && (
                    <p className="mt-2 text-xs font-medium text-destructive">
                      Upload a file for every sample before publishing.
                    </p>
                  )}
                </>
              )}
            </ReviewCard>

            {previewAsset && (
              <MediaPreviewLightbox
                asset={previewAsset}
                onClose={() => setPreviewAsset(null)}
              />
            )}

            {isAdmin && draft.campaignId && !draft.brandProfileId && (
              <div className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Brand collaboration</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {draft.inviteAcceptedAt
                        ? "A brand has accepted the invite."
                        : "Optionally invite a brand to collaborate before publishing."}
                    </p>
                  </div>
                  <Link
                    to={`/admin/campaigns/${draft.campaignId}/invite`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    <UserPlus className="h-4 w-4" />
                    {draft.inviteAcceptedAt ? "Manage invite" : "Invite brand"}
                  </Link>
                </div>
              </div>
            )}
          </div>

          <CampaignWizardFooter
            leftAction={{
              id: "back",
              label: backLabel,
              onClick: goBack,
              buttonProps: { size: "sm", variant: "outline" },
            }}
            rightActions={locked ? [] : reviewingSubmission ? [
              {
                id: "reject",
                label: "Send back",
                onClick: () => setRejectOpen(true),
                icon: <Undo2 className="h-4 w-4" />,
                buttonProps: { size: "sm", variant: "outline", disabled: saving },
              },
              ...(dirty
                ? [{
                    id: "save-live",
                    label: "Save changes",
                    onClick: requestSaveLiveChanges,
                    buttonProps: { size: "sm" as const, variant: "outline" as const, disabled: !budgetValid },
                  }]
                : []),
              {
                id: "approve",
                label: saving ? "Approving..." : "Approve & go live",
                onClick: () => void onPublish(),
                icon: !saving ? <ShieldCheck className="h-4 w-4" /> : undefined,
                buttonProps: {
                  size: "sm",
                  variant: "success",
                  // Edits must be saved (or discarded) before approving.
                  disabled: saving || !readyToPublish || dirty,
                },
              },
            ] : [
              autoSave
                ? {
                    id: "publish",
                    label: isAdmin
                      ? saving ? "Publishing..." : "Publish Campaign"
                      : saving ? "Submitting..." : "Submit for approval",
                    onClick: () => void onPublish(),
                    icon: !saving ? (isAdmin ? <Rocket className="h-4 w-4" /> : <Send className="h-4 w-4" />) : undefined,
                    buttonProps: {
                      size: "sm",
                      variant: "success",
                      disabled: saving || !readyToPublish,
                    },
                  }
                : {
                    // Already live/paused/closed: nothing to publish — edits are
                    // saved explicitly, after a confirm, since creators see them.
                    id: "save-live",
                    label: dirty ? "Save changes" : "No unsaved changes",
                    onClick: requestSaveLiveChanges,
                    buttonProps: {
                      size: "sm",
                      variant: "success",
                      disabled: !dirty || !budgetValid,
                    },
                  },
            ]}
          />
        </div>
      </WizardPage>
      {draft.campaignId && (
        <RejectCampaignDialog
          open={rejectOpen}
          campaignId={draft.campaignId}
          campaignTitle={draft.title}
          onCancel={() => setRejectOpen(false)}
          onRejected={() => {
            setRejectOpen(false);
            toast("Sent back to the brand with your reason.", "success");
            navigate("/admin/campaigns?status=pending_review");
          }}
        />
      )}
    </>
  );
}
