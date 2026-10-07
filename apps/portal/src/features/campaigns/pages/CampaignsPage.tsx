import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, WandSparkles } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CampaignListSkeleton } from "@/components/ui/page-skeletons";
import { useToast } from "@/components/ui/toaster";
import { CampaignStatusFilterTabs } from "@/features/campaigns/components/campaign-status-filter";
import { CampaignsGrid } from "@/features/campaigns/components/campaigns-grid";
import type { CampaignMenuAction } from "@/features/campaigns/components/campaign-row-actions";
import {
  useCampaignsList,
  useDeleteCampaign,
  useUpdateCampaignStatus,
} from "@/features/campaigns/hooks/use-campaigns";
import { ApiError, type Campaign, type CampaignStatusFilter } from "@/lib/api";
import { cn } from "@/lib/utils";
import { usePortalRole } from "@/providers/auth-provider";

export function CampaignsPage() {
  const role = usePortalRole();
  const isAdmin = role === "admin";
  const base = isAdmin ? "/admin/campaigns" : "/campaigns";
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<CampaignStatusFilter>("all");
  const [pendingAction, setPendingAction] = useState<{
    campaign: Campaign;
    action: CampaignMenuAction;
  } | null>(null);

  const { data, isPending, isError, isFetching } = useCampaignsList(statusFilter, 1);
  const updateStatus = useUpdateCampaignStatus();
  const deleteCampaign = useDeleteCampaign();

  const handleFilterChange = (value: CampaignStatusFilter) => {
    setStatusFilter(value);
  };

  const handleMenuAction = (campaign: Campaign, action: CampaignMenuAction) => {
    setPendingAction({ campaign, action });
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;

    try {
      if (pendingAction.action.kind === "delete") {
        await deleteCampaign.mutateAsync(pendingAction.campaign.id);
        toast("Campaign deleted.", "success");
      } else {
        await updateStatus.mutateAsync({
          id: pendingAction.campaign.id,
          status: pendingAction.action.status,
        });
        toast("Campaign updated.", "success");
      }
      setPendingAction(null);
    } catch (error) {
      toast(
        error instanceof ApiError ? error.message : "Could not complete this action.",
        "error",
      );
    }
  };

  const isConfirmLoading = updateStatus.isPending || deleteCampaign.isPending;

  if (isPending) {
    return <CampaignListSkeleton />;
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Campaigns
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "All campaigns across brands."
              : "Create and manage your creator campaigns."}
          </p>
        </div>
        <Link
          to={`${base}/new`}
          className={cn(buttonVariants(), "gap-2 self-start")}
        >
          <Plus className="h-4 w-4" />
          New campaign
        </Link>
      </div>

      <CampaignStatusFilterTabs value={statusFilter} onChange={handleFilterChange} />

      {isError ? (
        <Card className="p-6 text-sm text-rose-700">
          Could not load campaigns. Please try again.
        </Card>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <WandSparkles className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">No campaigns yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first campaign to start working with creators.
            </p>
          </div>
          <Link to={`${base}/new`} className={buttonVariants()}>
            Create campaign
          </Link>
        </Card>
      ) : (
        <CampaignsGrid
          campaigns={items}
          isAdmin={isAdmin}
          basePath={base}
          onMenuAction={handleMenuAction}
          isRefreshing={isFetching && !isPending}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onCancel={() => setPendingAction(null)}
        title={
          pendingAction?.action.kind === "delete"
            ? "Delete campaign?"
            : "Update campaign status?"
        }
        description={
          pendingAction?.action.kind === "delete"
            ? "This cannot be undone. Only draft or closed campaigns without submissions can be deleted."
            : `Change "${pendingAction?.campaign.title}" to ${pendingAction?.action.status}?`
        }
        confirmLabel={pendingAction?.action.kind === "delete" ? "Delete" : "Confirm"}
        variant={pendingAction?.action.kind === "delete" ? "destructive" : "default"}
        loading={isConfirmLoading}
        onConfirm={() => void confirmPendingAction()}
      />
    </div>
  );
}
