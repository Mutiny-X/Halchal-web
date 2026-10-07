import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  buildCampaignBody,
  hasInvalidReferenceAssets,
} from "@/features/campaigns/lib/campaign-payload";
import { ApiError, portalApi } from "@/lib/api";
import { useAuth, usePortalRole } from "@/providers/auth-provider";
import { useCampaignWizard } from "@/providers/campaign-wizard";

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function useCampaignDraftSave() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const role = usePortalRole();
  const isAdmin = role === "admin";
  const { draft, reset } = useCampaignWizard();
  const [saving, setSaving] = useState(false);

  const campaignsBase = isAdmin ? "/admin/campaigns" : "/campaigns";

  const publish = useCallback(async (): Promise<{ id: string }> => {
    if (hasInvalidReferenceAssets(draft.referenceAssets)) {
      throw new Error(
        "Upload files for all image/video sample content before publishing.",
      );
    }

    const token = getToken();
    if (!token) {
      throw new Error("Your session expired. Please log in again.");
    }

    setSaving(true);
    try {
      const body = buildCampaignBody(draft, "live");
      if (draft.campaignId) {
        const updated = await portalApi.campaigns.update(
          token,
          draft.campaignId,
          { ...body, wizardStep: "review" },
        );
        return { id: updated.id };
      }
      const created = await portalApi.campaigns.create(token, {
        ...body,
        wizardStep: "review",
      });
      return { id: created.id };
    } finally {
      setSaving(false);
    }
  }, [draft, getToken, isAdmin]);

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
    saving,
  };
}
