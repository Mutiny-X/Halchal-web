import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Eye, TrendingUp, UserPlus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  CampaignWizardFooter,
  CampaignWizardHeader,
  WizardPage,
} from "@/features/campaigns/components/campaign-wizard-layout";
import { WizardStepper } from "@/features/campaigns/components/wizard-stepper";
import {
  estimateMinClippersNeeded,
  estimateViewsFromBudget,
  formatEstimatedViews,
} from "@/features/campaigns/lib/estimate-views";
import { useWizardBack } from "@/features/campaigns/hooks/use-wizard-back";
import { useCampaignWizard } from "@/providers/campaign-wizard";

const PLATFORM_FEE_RATE = 0.15;

function formatRupees(value: number): string {
  if (!Number.isFinite(value)) return "₹0";
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function FieldError({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {children}
    </p>
  );
}

function SummaryLine({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className={bold ? "font-medium text-foreground" : "text-foreground"}>{value}</span>
    </div>
  );
}

export function CampaignPayoutPage() {
  const navigate = useNavigate();
  const { goBack, backLabel } = useWizardBack();
  const { draft, paths, update, saveNow } = useCampaignWizard();

  const rate = Number(draft.ratePer1kRupees);
  const maxPayout = Number(draft.maxPayoutRupees);
  const budget = Number(draft.budgetRupees);
  const estimatedViews = estimateViewsFromBudget(budget, rate);
  const minClippersNeeded = estimateMinClippersNeeded(budget, maxPayout);
  const platformFee = Number.isFinite(budget) ? budget * PLATFORM_FEE_RATE : 0;
  const totalCheckout = Number.isFinite(budget) ? budget + platformFee : 0;

  const rateValid = Number.isFinite(rate) && rate > 0;
  const maxPayoutValid = Number.isFinite(maxPayout) && maxPayout >= 1000;
  const budgetValid = Number.isFinite(budget) && maxPayoutValid && budget >= maxPayout;

  const canContinue = rateValid && maxPayoutValid && budgetValid;

  return (
    <>
      <WizardStepper />
      <WizardPage>
        <div className="pb-24">
          <CampaignWizardHeader
            title="Budget & Payouts"
            subtitle="Set your CPV model, campaign budget pool, and projected reach."
            onBack={goBack}
          />

          <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
            {/* ── Left: inputs ── */}
            <div className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="rate">
                    Rate
                  </label>
                  <p className="-mt-1.5 text-xs text-muted">₹ per 1,000 valid views.</p>
                  <Input
                    id="rate"
                    type="number"
                    min={1}
                    value={draft.ratePer1kRupees}
                    onChange={(e) => update({ ratePer1kRupees: e.target.value })}
                    className={!rateValid ? "border-destructive/50" : undefined}
                  />
                  {!rateValid && <FieldError>Enter a rate greater than ₹0.</FieldError>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="max">
                    Max payout
                  </label>
                  <p className="-mt-1.5 text-xs text-muted">Cap per creator.</p>
                  <Input
                    id="max"
                    type="number"
                    min={1000}
                    value={draft.maxPayoutRupees}
                    onChange={(e) => update({ maxPayoutRupees: e.target.value })}
                    className={!maxPayoutValid ? "border-destructive/50" : undefined}
                  />
                  {!maxPayoutValid && <FieldError>Must be at least ₹1,000.</FieldError>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground" htmlFor="budget">
                  Budget pool
                </label>
                <p className="-mt-1.5 text-xs text-muted">Total campaign budget.</p>
                <Input
                  id="budget"
                  type="number"
                  min={1000}
                  value={draft.budgetRupees}
                  onChange={(e) => update({ budgetRupees: e.target.value })}
                  className={cn("max-w-[280px]", !budgetValid && "border-destructive/50")}
                />
                {!budgetValid && maxPayoutValid && (
                  <FieldError>
                    Budget must be at least the max payout per creator ({formatRupees(maxPayout)}).
                  </FieldError>
                )}
              </div>

              <div className="rounded-xl border border-border bg-surface p-4">
                <div className="space-y-1 divide-y divide-border/70">
                  <SummaryLine label="Budget pool" value={formatRupees(budget || 0)} />
                  <SummaryLine label="Platform fee (15%)" value={formatRupees(platformFee)} />
                  <SummaryLine label="Total checkout" value={formatRupees(totalCheckout)} bold />
                </div>
                <p className="mt-3 text-xs text-muted">
                  Auto-pauses once the pool reaches 100% capacity to prevent over-delivery.
                </p>
              </div>
            </div>

            {/* ── Right: Estimated Views — the headline number for this step ── */}
            <div className="lg:sticky lg:top-6">
              <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-linear-to-br from-primary/15 via-primary/5 to-transparent p-6 shadow-[0_0_28px_rgba(99,14,212,0.18)]">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  <Eye className="h-4 w-4" />
                  Estimated Views
                </div>
                <p className="mt-3 font-display text-4xl font-black leading-none text-foreground">
                  {formatEstimatedViews(estimatedViews)}
                </p>
                <p className="mt-2 text-xs text-muted">at full budget spend</p>

                <div className="mt-5 flex items-center gap-2 rounded-xl bg-background/60 px-3 py-2 text-xs text-muted">
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {estimatedViews > 0
                    ? `${formatRupees(rate)} / 1K views · ${formatRupees(budget || 0)} pool`
                    : "Enter a valid rate and budget to see this."}
                </div>

                {minClippersNeeded > 0 && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl bg-background/60 px-3 py-2 text-xs text-muted">
                    <UserPlus className="h-3.5 w-3.5 shrink-0 text-primary" />
                    At least {minClippersNeeded.toLocaleString("en-IN")} clipper{minClippersNeeded !== 1 ? "s" : ""} needed to spend the full pool
                  </div>
                )}
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
                label: "Next: Review",
                onClick: () => {
                  void saveNow("review").then(() => navigate(paths.review));
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
