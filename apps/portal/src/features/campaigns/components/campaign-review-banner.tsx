import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, MessageSquareWarning, ShieldCheck, Undo2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toaster";
import { RejectCampaignDialog } from "@/features/campaigns/components/reject-campaign-dialog";
import { useUpdateCampaignStatus } from "@/features/campaigns/hooks/use-campaigns";
import { getWizardEditPath } from "@/features/campaigns/lib/wizard-paths";
import { ApiError, adminApi, type Campaign } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Approval state on the campaign page: waiting (admin approves or sends
 * back; brand/staff can withdraw), or sent back with the admin's reason. */
export function CampaignReviewBanner({ campaign, isAdmin }: { campaign: Campaign; isAdmin: boolean }) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateStatus = useUpdateCampaignStatus();
  const [confirm, setConfirm] = useState<"approve" | "withdraw" | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);

  const approve = useMutation({
    mutationFn: () => {
      const token = getToken();
      if (!token) throw new Error("Your session expired. Please log in again.");
      return adminApi.approveCampaign(token, campaign.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["campaign"] });
    },
  });

  async function onConfirm() {
    try {
      if (confirm === "approve") {
        await approve.mutateAsync();
        toast("Approved. The campaign is live and creators are being notified.", "success");
      } else if (confirm === "withdraw") {
        await updateStatus.mutateAsync({ id: campaign.id, status: "draft" });
        toast("Withdrawn. You can edit it again, then resubmit.", "success");
      }
      setConfirm(null);
    } catch (error) {
      toast(error instanceof ApiError || error instanceof Error ? error.message : "Something went wrong.", "error");
    }
  }

  if (campaign.status === "draft" && campaign.reviewRejectionReason) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
        <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            {isAdmin ? "Sent back to the brand" : "An admin asked for changes before this can go live"}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-muted">{campaign.reviewRejectionReason}</p>
        </div>
        {!isAdmin && (
          <Link
            to={getWizardEditPath(campaign.id, false)}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "shrink-0")}
          >
            Make changes
          </Link>
        )}
      </div>
    );
  }

  if (campaign.status !== "pending_review") return null;

  const submitted = formatWhen(campaign.submittedForReviewAt);
  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm text-foreground">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="font-semibold">
              {isAdmin ? "Waiting for your approval" : "Waiting for admin approval"}
            </span>
            {submitted ? <span className="text-muted"> · submitted {submitted}</span> : null}
            <span className="block text-muted">
              {isAdmin
                ? "Creators can't see it yet. Approving puts it live right away."
                : "Creators can't see it yet. It goes live as soon as it's approved. Withdraw it to make changes."}
            </span>
          </span>
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          {isAdmin ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
                <Undo2 className="mr-1.5 h-4 w-4" />
                Send back
              </Button>
              <Button size="sm" variant="success" onClick={() => setConfirm("approve")}>
                <ShieldCheck className="mr-1.5 h-4 w-4" />
                Approve &amp; go live
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirm("withdraw")}>
              Withdraw to edit
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "approve" ? `Approve "${campaign.title}"?` : "Withdraw from review?"}
        description={
          confirm === "approve"
            ? "It goes live immediately and every creator is notified. Check the full details first (Review / edit) if you haven't."
            : "It goes back to a draft so you can edit it. Submit it again when you're ready."
        }
        confirmLabel={confirm === "approve" ? "Approve & go live" : "Withdraw"}
        loading={approve.isPending || updateStatus.isPending}
        onConfirm={() => void onConfirm()}
        onCancel={() => setConfirm(null)}
      />
      <RejectCampaignDialog
        open={rejectOpen}
        campaignId={campaign.id}
        campaignTitle={campaign.title}
        onCancel={() => setRejectOpen(false)}
        onRejected={() => {
          setRejectOpen(false);
          toast("Sent back to the brand with your reason.", "success");
        }}
      />
    </>
  );
}
