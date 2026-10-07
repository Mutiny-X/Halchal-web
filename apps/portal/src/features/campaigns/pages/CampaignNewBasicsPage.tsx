import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Globe2,
  Lightbulb,
  Loader2,
  MapPin,
  Upload,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import {
  CampaignWizardFooter,
  CampaignWizardHeader,
  WizardPage,
} from "@/features/campaigns/components/campaign-wizard-layout";
import { StateMultiSelect } from "@/features/campaigns/components/state-multi-select";
import { WizardStepper } from "@/features/campaigns/components/wizard-stepper";
import { useWizardBack } from "@/features/campaigns/hooks/use-wizard-back";
import { PLATFORM_OPTIONS } from "@/features/campaigns/lib/platform-options";
import { normalizeUploadUrl, resolveMediaUrl } from "@/lib/media-url";
import { adminApi, ApiError, brandApi } from "@/lib/api";
import { useAuth, usePortalRole } from "@/providers/auth-provider";
import { useCampaignWizard } from "@/providers/campaign-wizard";

const CATEGORY_OPTIONS = [
  "Fashion",
  "Beauty",
  "Tech & Gadgets",
  "Food & Beverage",
  "Fitness & Health",
  "Travel",
  "Gaming",
  "Lifestyle",
  "Entertainment",
  "Finance",
  "Education",
  "Other",
];

const MAX_COVER_BYTES = 50 * 1024 * 1024;

function ValidCheck() {
  return (
    <span className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-money/15 text-money">
      <Check className="h-3 w-3" strokeWidth={3} />
    </span>
  );
}

export function CampaignNewBasicsPage() {
  const navigate = useNavigate();
  const { draft, paths, update, saveNow, loading } = useCampaignWizard();
  const { goBack, backLabel } = useWizardBack();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const selectedPlatform = draft.platforms[0];

  // "Other" is a picker trigger, not a real stored value — once chosen (or
  // once an existing campaign loads with a category outside the preset
  // list), show a text field so the actual custom category can be typed.
  const [customCategoryOpen, setCustomCategoryOpen] = useState(false);
  useEffect(() => {
    if (!loading && draft.category && !CATEGORY_OPTIONS.includes(draft.category)) {
      setCustomCategoryOpen(true);
    }
  }, [loading, draft.category]);

  const role = usePortalRole();
  const isAdmin = role === "admin";
  // Campaigns created from a brand's page already have a brandProfileId — only
  // an admin creating from the global Campaigns list needs to pick one here.
  // Captured once (after the draft has settled) rather than recomputed live,
  // so the picker doesn't vanish out from under you the moment you use it.
  const startedWithoutBrandRef = useRef<boolean | null>(null);
  if (!loading && startedWithoutBrandRef.current === null) {
    startedWithoutBrandRef.current = !draft.brandProfileId;
  }
  const needsBrandAssignment = isAdmin && (startedWithoutBrandRef.current ?? false);
  const { data: brands = [], isPending: brandsLoading } = useQuery({
    queryKey: ["admin-brands-picker"],
    queryFn: () => adminApi.brands(getToken()!),
    enabled: needsBrandAssignment && Boolean(getToken()),
  });

  const onCoverSelected = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Cover must be an image (PNG, JPG, or WEBP).", "error");
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      toast("Cover image must be 50MB or smaller.", "error");
      return;
    }
    const token = getToken();
    if (!token) {
      toast("Your session expired. Please log in again.", "error");
      return;
    }
    setUploadingCover(true);
    try {
      const uploaded = await brandApi.campaigns.uploadCoverImage(token, file);
      update({ coverImageUrl: normalizeUploadUrl(uploaded) });
      toast("Cover image uploaded.", "success");
    } catch (error) {
      toast(
        error instanceof ApiError ? error.message : "Failed to upload cover image.",
        "error",
      );
    } finally {
      setUploadingCover(false);
    }
  };

  const hasPlatform = draft.platforms.length > 0;
  const hasValidLocation =
    draft.locationType === "pan_india" || draft.targetStates.length > 0;

  return (
    <>
      <WizardStepper />
      <WizardPage>
        <div className="pb-24">
          <CampaignWizardHeader
            title={draft.campaignId ? "Edit Campaign" : "Create New Campaign"}
            subtitle="Set up your performance-driven creator campaign."
            onBack={goBack}
          />

          <div className="grid gap-6 lg:grid-cols-[320px_1fr] lg:items-start">
            {/* ── Left: cover image + tips ── */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-surface p-5">
                <p className="text-sm font-semibold text-foreground">Cover image</p>
                <p className="mt-0.5 text-xs text-muted">16:9 — shown across the app.</p>

                <button
                  type="button"
                  disabled={uploadingCover}
                  onClick={() => coverInputRef.current?.click()}
                  className={cn(
                    "relative mt-4 block aspect-video w-full overflow-hidden rounded-xl border border-border bg-background",
                    uploadingCover && "opacity-70",
                  )}
                >
                  {draft.coverImageUrl ? (
                    <img
                      src={resolveMediaUrl(draft.coverImageUrl)}
                      alt="Campaign cover preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-linear-to-br from-primary/15 to-primary/5 text-muted">
                      <Upload className="h-6 w-6 text-primary/40" strokeWidth={1.5} />
                      <span className="text-xs">No image yet</span>
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  disabled={uploadingCover}
                  onClick={() => coverInputRef.current?.click()}
                  className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-foreground transition hover:bg-surface-variant"
                >
                  {uploadingCover ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      {draft.coverImageUrl ? "Replace image" : "Upload image"}
                    </>
                  )}
                </button>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => void onCoverSelected(e.target.files?.[0])}
                />
              </div>

              <div className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Tips</p>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Use a high-quality banner that represents your campaign.
                </p>
              </div>
            </div>

            {/* ── Right: form fields ── */}
            <div className="space-y-6">
              {needsBrandAssignment ? (
                <div className="space-y-2">
                  <label htmlFor="brand" className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                    <Building2 className="h-4 w-4 text-primary" />
                    Brand
                  </label>
                  <p className="-mt-1.5 text-xs text-muted">
                    This campaign isn't tied to a brand yet — assign one to publish it.
                  </p>
                  <div className="relative">
                    <select
                      id="brand"
                      value={draft.brandProfileId ?? ""}
                      disabled={brandsLoading}
                      onChange={(e) =>
                        update({ brandProfileId: e.target.value || null })
                      }
                      className={cn(
                        "h-11 w-full appearance-none rounded-xl border border-border bg-surface px-4 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        draft.brandProfileId ? "pr-16" : "pr-9",
                      )}
                    >
                      <option value="">
                        {brandsLoading ? "Loading brands..." : "Select a brand"}
                      </option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.companyName}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    {draft.brandProfileId && (
                      <span className="absolute right-9 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-money/15 text-money">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium text-foreground">
                  Campaign name
                </label>
                <div className="relative">
                  <Input
                    id="title"
                    value={draft.title}
                    onChange={(e) => update({ title: e.target.value })}
                    placeholder="e.g. Summer Launch Reels Challenge"
                    className={draft.title.trim() ? "pr-10" : undefined}
                  />
                  {draft.title.trim() && <ValidCheck />}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="category" className="text-sm font-medium text-foreground">
                  Category
                </label>
                <div className="relative">
                  <select
                    id="category"
                    value={customCategoryOpen ? "Other" : draft.category}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "Other") {
                        setCustomCategoryOpen(true);
                        update({ category: "" });
                      } else {
                        setCustomCategoryOpen(false);
                        update({ category: value });
                      }
                    }}
                    className={cn(
                      "h-11 w-full appearance-none rounded-xl border border-border bg-surface px-4 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      draft.category ? "pr-16" : "pr-9",
                    )}
                  >
                    <option value="">Select a category</option>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  {draft.category && (
                    <span className="absolute right-9 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-money/15 text-money">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </div>
                {customCategoryOpen && (
                  <Input
                    value={draft.category}
                    onChange={(e) => update({ category: e.target.value })}
                    placeholder="Enter your category"
                    autoFocus
                  />
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Platform</p>
                <p className="-mt-1.5 text-xs text-muted">The platform creators will post to.</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {PLATFORM_OPTIONS.map(({ value, label, icon: Icon, badge }) => {
                    const isSelected = selectedPlatform === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => update({ platforms: [value] })}
                        className={cn(
                          "relative flex flex-col items-center gap-2 rounded-2xl border bg-surface px-3 py-4 transition",
                          isSelected
                            ? "border-primary shadow-[0_0_16px_rgba(99,14,212,0.28)] ring-2 ring-primary/25"
                            : "border-border hover:border-foreground/20",
                        )}
                      >
                        {isSelected && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        )}
                        <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white", badge)}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="text-center text-xs font-medium text-foreground">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Location</p>
                <p className="-mt-1.5 text-xs text-muted">Select the location for your campaign.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => update({ locationType: "pan_india", targetStates: [] })}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                      draft.locationType === "pan_india"
                        ? "border-primary bg-primary text-primary-foreground shadow-[0_0_16px_rgba(99,14,212,0.3)]"
                        : "border-border bg-surface text-foreground hover:bg-surface-variant",
                    )}
                  >
                    <Globe2 className="h-4 w-4" />
                    Pan India
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ locationType: "states" })}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                      draft.locationType === "states"
                        ? "border-primary bg-primary text-primary-foreground shadow-[0_0_16px_rgba(99,14,212,0.3)]"
                        : "border-border bg-surface text-foreground hover:bg-surface-variant",
                    )}
                  >
                    <MapPin className="h-4 w-4" />
                    Select states
                  </button>
                </div>

                {draft.locationType === "states" && (
                  <div className="pt-1">
                    <StateMultiSelect
                      selected={draft.targetStates}
                      onChange={(targetStates) => update({ targetStates })}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="startDate" className="text-sm font-medium text-foreground">
                  Start date
                </label>
                <Input
                  id="startDate"
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => update({ startDate: e.target.value })}
                  className="max-w-[220px]"
                />
              </div>
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
                label: "Next: Brief & Rules",
                onClick: () => {
                  void saveNow("brief").then(() => navigate(paths.brief));
                },
                icon: <ArrowRight className="h-4 w-4" />,
                buttonProps: {
                  size: "sm",
                  disabled:
                    !draft.title.trim() ||
                    !draft.category ||
                    !draft.coverImageUrl ||
                    !draft.startDate ||
                    !hasPlatform ||
                    !hasValidLocation ||
                    (needsBrandAssignment && !draft.brandProfileId),
                },
              },
            ]}
          />
        </div>
      </WizardPage>
    </>
  );
}
