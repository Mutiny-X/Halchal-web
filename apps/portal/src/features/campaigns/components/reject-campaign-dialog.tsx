import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toaster";
import { ApiError, adminApi } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

const MIN_REASON = 5;
const MAX_REASON = 1000;

/** Admin sends a submitted campaign back to the brand as a draft. The
 * reason is shown to the brand, so it's required. */
export function RejectCampaignDialog({
  open,
  campaignId,
  campaignTitle,
  onCancel,
  onRejected,
}: {
  open: boolean;
  campaignId: string;
  campaignTitle: string;
  onCancel: () => void;
  onRejected: () => void;
}) {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const trimmed = reason.trim();

  async function send() {
    const token = getToken();
    if (!token) {
      toast("Your session expired. Please log in again.", "error");
      return;
    }
    setSending(true);
    try {
      await adminApi.rejectCampaign(token, campaignId, trimmed);
      void queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      void queryClient.invalidateQueries({ queryKey: ["campaign"] });
      onRejected();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't send it back. Please try again.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      title={`Send "${campaignTitle || "this campaign"}" back?`}
      description="It returns to the brand as a draft, with your reason, so they can fix it and submit again. Creators never see it."
      confirmLabel="Send back"
      variant="destructive"
      loading={sending}
      confirmDisabled={trimmed.length < MIN_REASON}
      onConfirm={() => void send()}
      onCancel={onCancel}
    >
      <label htmlFor="reject-reason" className="text-xs font-semibold text-foreground">
        What needs to change?
      </label>
      <textarea
        id="reject-reason"
        name="reject-reason"
        autoComplete="off"
        autoFocus
        rows={4}
        maxLength={MAX_REASON}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. The brief doesn't say which product to show. Please add it."
        className="mt-1.5 w-full rounded-xl border border-border bg-surface-variant px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
      <p className="mt-1 text-[11px] text-muted">
        {trimmed.length < MIN_REASON
          ? `At least ${MIN_REASON} characters. The brand sees this.`
          : `${trimmed.length}/${MAX_REASON}. The brand sees this.`}
      </p>
    </ConfirmDialog>
  );
}
