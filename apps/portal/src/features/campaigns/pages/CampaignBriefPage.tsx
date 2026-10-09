import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileVideo,
  Lightbulb,
  ListChecks,
  Paperclip,
} from "lucide-react";

import { useToast } from "@/components/ui/toaster";
import {
  CampaignWizardFooter,
  CampaignWizardHeader,
  WizardPage,
} from "@/features/campaigns/components/campaign-wizard-layout";
import { ReferenceAssetsEditor } from "@/features/campaigns/components/reference-assets-editor";
import { SourceAssetsEditor } from "@/features/campaigns/components/source-assets-editor";
import { RulePointsEditor } from "@/features/campaigns/components/rule-points-editor";
import { WizardStepper } from "@/features/campaigns/components/wizard-stepper";
import { hasInvalidReferenceAssets } from "@/features/campaigns/lib/campaign-payload";
import { parseRulePoints } from "@/features/campaigns/lib/rule-points";
import { normalizeUploadUrl } from "@/lib/media-url";
import { ApiError, brandApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useWizardBack } from "@/features/campaigns/hooks/use-wizard-back";
import { useCampaignWizard } from "@/providers/campaign-wizard";
import { sourceLinkProblem } from "@/features/campaigns/lib/source-assets";
import { checkMediaFile, checkSourceFile } from "@/features/campaigns/lib/upload-rules";
import { useAuth } from "@/providers/auth-provider";
import type { OnUploadProgress } from "@/lib/api";

type SourceRequirement = "mandatory" | "optional" | "not_required";

const REQUIREMENT_OPTIONS: { value: SourceRequirement; label: string }[] = [
  { value: "mandatory", label: "Mandatory" },
  { value: "optional", label: "Optional" },
  { value: "not_required", label: "Not required" },
];

function RequirementToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SourceRequirement;
  onChange: (value: SourceRequirement) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
        {REQUIREMENT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              value === option.value
                ? "bg-primary text-primary-foreground"
                : "text-muted hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CardHeader({ icon: Icon, title }: { icon: typeof Lightbulb; title: string }) {
  return (
    <div className="mb-1 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
    </div>
  );
}

export function CampaignBriefPage() {
  const { goBack, backLabel } = useWizardBack();
  const { draft, update, goToStep } = useCampaignWizard();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const uploadReferenceAsset = async (
    file: File,
    expectedType: "image" | "video",
    onProgress?: OnUploadProgress,
  ): Promise<string> => {
    const token = getToken();
    if (!token) {
      throw new Error("Your session expired. Please log in again.");
    }
    const uploaded =
      await brandApi.campaigns.uploadReferenceAsset(token, file, onProgress);
    if (uploaded.type !== expectedType) {
      throw new Error(`Please upload a valid ${expectedType} file.`);
    }
    return normalizeUploadUrl(uploaded);
  };

  const doPoints = useMemo(() => parseRulePoints(draft.doRules), [draft.doRules]);
  const avoidPoints = useMemo(() => parseRulePoints(draft.avoidRules), [draft.avoidRules]);
  const invalidAssets = hasInvalidReferenceAssets(draft.referenceAssets);

  const hasValidSourceAssets =
    draft.sourceAssets.length > 0 &&
    draft.sourceAssets.every(
      (a) => a.url.trim().length > 0 && !sourceLinkProblem(a.type, a.url),
    );

  const canContinue =
    draft.briefHook.trim().length > 0 &&
    doPoints.length > 0 &&
    avoidPoints.length > 0 &&
    hasValidSourceAssets;
  const allDone = canContinue && (draft.referenceAssets.length === 0 || !invalidAssets);

  const checklist = [
    { label: "Creative brief written", ok: draft.briefHook.trim().length > 0, required: true },
    { label: "Do points added", ok: doPoints.length > 0, required: true },
    { label: "Avoid points added", ok: avoidPoints.length > 0, required: true },
    { label: "Source assets added", ok: hasValidSourceAssets, required: true },
    { label: "Sample content uploaded (optional)", ok: draft.referenceAssets.length > 0 && !invalidAssets, required: false },
  ];

  return (
    <>
      <WizardStepper />
      <WizardPage>
        <div className="pb-24">
          <CampaignWizardHeader
            title="Campaign Brief & Rules"
            subtitle="Define the creative direction and campaign guardrails."
            onBack={goBack}
          />

          <div className="mx-auto max-w-[760px] space-y-6">
            {/* ── Checklist ── */}
            <div
              className={cn(
                "rounded-2xl border p-5",
                allDone ? "border-money/30 bg-money/[0.04]" : "border-warning/30 bg-warning/[0.04]",
              )}
            >
              <div className="flex items-center gap-2">
                {allDone ? (
                  <Check className="h-4 w-4 text-money" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-warning" />
                )}
                <p className="text-sm font-semibold text-foreground">
                  {allDone ? "Brief complete" : "Brief checklist"}
                </p>
              </div>
              <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {checklist.map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-sm">
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
                  </div>
                ))}
              </div>
            </div>

            {/* ── Creative brief ── */}
            <div className="rounded-2xl border border-border bg-surface p-5">
              <CardHeader icon={Lightbulb} title="Creative Brief" />
              <p className="mb-3 text-xs text-muted">Hook, tone, and key messaging.</p>
              <textarea
                name="campaign-brief"
                autoComplete="off"
                className="min-h-[140px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/70 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                placeholder="e.g. Open with a bold question in the first 3 seconds. Keep the tone energetic and youth-focused. Highlight the product benefit clearly before the 10-second mark."
                maxLength={1000}
                value={draft.briefHook}
                onChange={(e) => update({ briefHook: e.target.value })}
              />
              <p className="mt-1 text-right text-[11px] text-muted">{draft.briefHook.length} / 1000</p>
            </div>

            {/* ── Guardrails ── */}
            <div className="rounded-2xl border border-border bg-surface p-5">
              <CardHeader icon={ListChecks} title="Guardrails" />
              <p className="mb-4 text-xs text-muted">Clear do's and don'ts for creators.</p>
              <div className="space-y-5">
                <RulePointsEditor
                  variant="do"
                  title="Do this"
                  description="Add each instruction as its own point."
                  addLabel="Add do point"
                  placeholder="e.g. Show the product in the first 3 seconds"
                  emptyHint="No do points yet. Add what creators should include."
                  value={draft.doRules}
                  onChange={(doRules) => update({ doRules })}
                />
                <RulePointsEditor
                  variant="avoid"
                  title="Avoid this"
                  description="Add each restriction as its own point."
                  addLabel="Add avoid point"
                  placeholder="e.g. Do not mention competitor names"
                  emptyHint="No avoid points yet. Add what creators must skip."
                  value={draft.avoidRules}
                  onChange={(avoidRules) => update({ avoidRules })}
                />
              </div>
            </div>

            {/* ── Sample content ── */}
            <div className="rounded-2xl border border-border bg-surface p-5">
              <CardHeader icon={FileVideo} title="Sample Content" />
              <p className="mb-3 text-xs text-muted">Sample images (post) or videos (reel).</p>
              <ReferenceAssetsEditor
                assets={draft.referenceAssets}
                onChange={(next) =>
                  update((d) => ({
                    referenceAssets: typeof next === "function" ? next(d.referenceAssets) : next,
                  }))
                }
                onUploadFile={async (file, type, onProgress) => {
                  const oversizeMessage = checkMediaFile(file, type);
                  if (oversizeMessage) {
                    toast(oversizeMessage, "error");
                    throw new Error(oversizeMessage);
                  }
                  try {
                    const url = await uploadReferenceAsset(file, type, onProgress);
                    toast("Sample file uploaded.", "success");
                    return url;
                  } catch (error) {
                    toast(
                      error instanceof ApiError
                        ? error.message
                        : error instanceof Error
                          ? error.message
                          : "Failed to upload file",
                      "error",
                    );
                    throw error;
                  }
                }}
              />
            </div>

            {/* ── Source assets ── */}
            <div className="rounded-2xl border border-border bg-surface p-5">
              <CardHeader icon={Paperclip} title="Source Assets" />
              <p className="mb-3 text-xs text-muted">Drive/YouTube links, or a file uploaded from this device, that creators can use.</p>
              <SourceAssetsEditor
                assets={draft.sourceAssets}
                onChange={(next) =>
                  update((d) => ({
                    sourceAssets: typeof next === "function" ? next(d.sourceAssets) : next,
                  }))
                }
                onUploadFile={async (file, onProgress) => {
                  const oversizeMessage = checkSourceFile(file);
                  if (oversizeMessage) {
                    toast(oversizeMessage, "error");
                    throw new Error(oversizeMessage);
                  }
                  try {
                    const token = getToken()!;
                    const uploaded =
                      await brandApi.campaigns.uploadSourceAsset(token, file, onProgress);
                    toast("File uploaded.", "success");
                    return normalizeUploadUrl(uploaded);
                  } catch (error) {
                    toast(
                      error instanceof ApiError
                        ? error.message
                        : error instanceof Error
                          ? error.message
                          : "Failed to upload file",
                      "error",
                    );
                    throw error;
                  }
                }}
                onCheckUrl={(url) => brandApi.campaigns.checkSourceAssetUrl(getToken()!, url)}
              />
              {draft.sourceAssets.length > 0 ? (
                <div className="mt-4 space-y-2.5 border-t border-border pt-4">
                  <RequirementToggle
                    label="Clippers must use this footage"
                    value={draft.sourceVideoRequirement}
                    onChange={(sourceVideoRequirement) => update({ sourceVideoRequirement })}
                  />
                  <RequirementToggle
                    label="Clippers must use this audio/song"
                    value={draft.sourceAudioRequirement}
                    onChange={(sourceAudioRequirement) => update({ sourceAudioRequirement })}
                  />
                  <p className="text-[11px] text-muted">
                    "Optional" still gets checked and shown on review, but never blocks a submission on its own.
                    Use this when only the audio matters (e.g. pushing a song) and any footage is fine.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <CampaignWizardFooter
            leftAction={{
              id: "back",
              label: backLabel,
              onClick: goBack,
              buttonProps: { size: "sm", variant: "outline" },
            }}
            rightActions={[
              {
                id: "next",
                label: "Next: Budget",
                onClick: () => {
                  void goToStep("payout").then((result) => {
                    if (!result.ok) toast(result.error, "error");
                  });
                },
                icon: <ArrowRight className="h-4 w-4" />,
                buttonProps: { size: "sm", disabled: !canContinue },
              },
            ]}
          />
        </div>
      </WizardPage>
    </>
  );
}
