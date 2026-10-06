import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { hasInvalidReferenceAssets } from "@/features/campaigns/lib/campaign-payload";
import { ApiError } from "@/lib/api";
import { usePortalRole } from "@/providers/auth-provider";
import { useCampaignWizard } from "@/providers/campaign-wizard";

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function useCampaignDraftSave() {
  const navigate = useNavigate();
  const role = usePortalRole();
  const isAdmin = role === "admin";
  const { draft, reset, publish: publishFromWizard } = useCampaignWizard();
  const [publishing, setPublishing] = useState(false);

  const campaignsBase = isAdmin ? "/admin/campaigns" : "/campaigns";

  const publish = useCallback(async (): Promise<{ id: string }> => {
    if (hasInvalidReferenceAssets(draft.referenceAssets)) {
      throw new Error(
        "Upload files for all image/video sample content before publishing.",
      );
    }
    setPublishing(true);
    try {
      // Goes through the wizard's save queue: any pending auto-save is
      // folded in and runs first, so nothing can land after the publish.
      return await publishFromWizard();
    } finally {
      setPublishing(false);
    }
  }, [draft.referenceAssets, publishFromWizard]);

  const publishWithFeedback = useCallback(
    async (
      toast: (message: string, type?: "success" | "error") => void,
    ): Promise<string | null> => {
      try {
        const result = await publish();
        toast("Campaign published. Creators can now discover it.", "success");
        reset();
        navigate(campaignsBase);
        return result.id;
      } catch (error) {
        toast(apiErrorMessage(error, "Could not publish campaign."), "error");
        return null;
      }
    },
    [campaignsBase, navigate, publish, reset],
  );

  return {
    publish,
    publishWithFeedback,
    saving: publishing,
  };
}
