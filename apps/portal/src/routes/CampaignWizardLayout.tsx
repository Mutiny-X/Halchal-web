import { Outlet, useParams } from "react-router-dom";

import { PortalShellSkeleton } from "@/components/ui/page-skeletons";
import { CampaignWizardProvider, useCampaignWizard } from "@/providers/campaign-wizard";

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

  return <Outlet />;
}

export function CampaignWizardLayout() {
  const { id } = useParams<{ id?: string }>();

  return (
    <CampaignWizardProvider editCampaignId={id}>
      <WizardOutlet />
    </CampaignWizardProvider>
  );
}
