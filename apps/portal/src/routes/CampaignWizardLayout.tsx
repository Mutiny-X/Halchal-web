import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Navigate, Outlet, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { PortalShellSkeleton } from "@/components/ui/page-skeletons";
import { WIZARD_SHELL_WIDTH } from "@/features/campaigns/components/campaign-wizard-layout";
import { cn } from "@/lib/utils";
import { usePortalRole } from "@/providers/auth-provider";
import { CampaignWizardProvider, useCampaignWizard } from "@/providers/campaign-wizard";

/** Tells the user, at all times, whether their work is on the server. */
function WizardSaveBar() {
  const { draft, autoSave, dirty, saveState, saveError, retrySave, requestSaveLiveChanges } =
    useCampaignWizard();

  if (!autoSave) {
    return (
      <div className={cn("mx-auto mb-4 w-full", WIZARD_SHELL_WIDTH)}>
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">
            This campaign is <span className="font-semibold">{draft.status}</span>. Edits aren't
            saved automatically — creators keep seeing the current version until you click
            Save changes.
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
  const { loading, loadError } = useCampaignWizard();

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

  return (
    <>
      <WizardSaveBar />
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
