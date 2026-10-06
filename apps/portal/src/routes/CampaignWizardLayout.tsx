import { useState } from "react";
import { AlertCircle, Check, Clock, Loader2, MessageSquareWarning } from "lucide-react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { campaignStatusLabel } from "@/features/campaigns/lib/campaign-status";
import { ApiError } from "@/lib/api";
import { PortalShellSkeleton } from "@/components/ui/page-skeletons";
import { WIZARD_SHELL_WIDTH } from "@/features/campaigns/components/campaign-wizard-layout";
import { cn } from "@/lib/utils";
import { usePortalRole } from "@/providers/auth-provider";
import { CampaignWizardProvider, useCampaignWizard } from "@/providers/campaign-wizard";

/** Waiting for an admin: nothing can be edited until it's withdrawn. */
function AwaitingApprovalBar() {
  const { withdraw } = useCampaignWizard();
  const { toast } = useToast();
  const [withdrawing, setWithdrawing] = useState(false);

  async function onWithdraw() {
    setWithdrawing(true);
    try {
      await withdraw();
      toast("Withdrawn. You can edit it again, then resubmit.", "success");
    } catch (error) {
      toast(error instanceof ApiError || error instanceof Error ? error.message : "Couldn't withdraw it.", "error");
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className={cn("mx-auto mb-4 w-full", WIZARD_SHELL_WIDTH)}>
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm text-foreground">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="font-semibold">Waiting for admin approval.</span> It goes live for
            creators as soon as it's approved. To change anything, withdraw it first.
          </span>
        </p>
        <Button size="sm" variant="outline" disabled={withdrawing} onClick={() => void onWithdraw()}>
          {withdrawing ? "Withdrawing..." : "Withdraw to edit"}
        </Button>
      </div>
    </div>
  );
}

/** An admin sent it back: show why, until it's submitted again. */
function SentBackNotice() {
  const { draft } = useCampaignWizard();
  if (draft.status !== "draft" || !draft.reviewRejectionReason) return null;
  return (
    <div className={cn("mx-auto mb-4 w-full", WIZARD_SHELL_WIDTH)}>
      <div className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
        <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0">
          <p className="font-semibold">An admin asked for changes before this can go live</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-muted">{draft.reviewRejectionReason}</p>
        </div>
      </div>
    </div>
  );
}

/** Tells the user, at all times, whether their work is on the server. */
function WizardSaveBar() {
  const { draft, autoSave, dirty, locked, saveState, saveError, retrySave, requestSaveLiveChanges } =
    useCampaignWizard();

  if (locked) return <AwaitingApprovalBar />;

  if (!autoSave) {
    const waiting = draft.status === "pending_review";
    return (
      <div className={cn("mx-auto mb-4 w-full", WIZARD_SHELL_WIDTH)}>
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            This campaign is <span className="font-semibold">{campaignStatusLabel(draft.status)}</span>.{" "}
            {waiting
              ? "Edits aren't saved automatically. Save them before you approve, or approve it as it is."
              : "Edits aren't saved automatically — creators keep seeing the current version until you click Save changes."}
            {saveState === "error" && saveError && (
              <span className="mt-1 block text-rose-500">Last save failed: {saveError}</span>
            )}
          </p>
          <Button size="sm" variant="success" disabled={!dirty} onClick={requestSaveLiveChanges}>
            {dirty ? "Save changes" : "No unsaved changes"}
          </Button>
        </div>
      </div>
    );
  }

  if (saveState === "idle") return null;

  return (
    <div className={cn("mx-auto mb-2 flex w-full justify-end", WIZARD_SHELL_WIDTH)} aria-live="polite">
      {saveState === "saving" && (
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
        </span>
      )}
      {saveState === "saved" && (
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Check className="h-3.5 w-3.5" /> All changes saved
        </span>
      )}
      {saveState === "error" && (
        <span className="flex items-center gap-2 text-xs text-rose-500">
          <AlertCircle className="h-3.5 w-3.5" />
          Couldn't save{saveError ? `: ${saveError}` : ""}
          <Button size="sm" variant="outline" onClick={retrySave}>
            Retry
          </Button>
        </span>
      )}
    </div>
  );
}

function WizardOutlet() {
  const { loading, loadError, locked, paths } = useCampaignWizard();
  const location = useLocation();

  if (loading) {
    return <PortalShellSkeleton />;
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-800">
        {loadError}
      </div>
    );
  }

  // Locked while waiting for approval: show the full read-only review,
  // with every control disabled (the Withdraw button sits outside).
  if (locked) {
    if (!location.pathname.endsWith("/review")) {
      return <Navigate to={paths.review} replace />;
    }
    return (
      <>
        <WizardSaveBar />
        <fieldset disabled className="m-0 min-w-0 border-0 p-0">
          <Outlet />
        </fieldset>
      </>
    );
  }

  return (
    <>
      <WizardSaveBar />
      <SentBackNotice />
      <Outlet />
    </>
  );
}

export function CampaignWizardLayout() {
  const { id } = useParams<{ id?: string }>();
  const role = usePortalRole();

  // Staff always create campaigns from a brand they're assigned to (that
  // page passes the brand). A blank "new" wizard has no brand to attach to.
  if (role === "staff" && !id) {
    return <Navigate to="/staff/brands" replace />;
  }

  return (
    <CampaignWizardProvider editCampaignId={id}>
      <WizardOutlet />
    </CampaignWizardProvider>
  );
}
