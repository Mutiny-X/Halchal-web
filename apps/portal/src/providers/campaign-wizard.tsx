import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

import { campaignToDraft } from "@/features/campaigns/lib/campaign-from-api";
import { buildCampaignBody } from "@/features/campaigns/lib/campaign-payload";
import type { ReferenceAsset } from "@/features/campaigns/lib/reference-assets";
import type { SourceAsset } from "@/features/campaigns/lib/source-assets";
import {
  getWizardPaths,
  type WizardPaths,
} from "@/features/campaigns/lib/wizard-paths";
import { ApiError, portalApi } from "@/lib/api";
import { joinCampaignRoom, leaveCampaignRoom } from "@/lib/socket";
import { useAuth, usePortalRole } from "@/providers/auth-provider";

export type CampaignDraft = {
  campaignId: string | null;
  status: "draft" | "live" | "paused" | "closed";
  ownership?: "brand_created" | "admin_created";
  /** Furthest step this campaign has genuinely reached — server-enforced,
   * never regresses. Drives which steps the stepper allows jumping to. */
  wizardStep: "basics" | "brief" | "payout" | "review";
  brandProfileId: string | null;
  inviteAcceptedAt?: string | null;
  coverImageUrl: string;
  title: string;
  category: string;
  platforms: string[];
  locationType: "pan_india" | "states";
  targetStates: string[];
  startDate: string;
  briefHook: string;
  doRules: string;
  avoidRules: string;
  sourceAssets: SourceAsset[];
  sourceVideoRequirement: "mandatory" | "optional" | "not_required";
  sourceAudioRequirement: "mandatory" | "optional" | "not_required";
  referenceAssets: ReferenceAsset[];
  brief: string;
  productUrl: string;
  ratePer1kRupees: string;
  maxPayoutRupees: string;
  budgetRupees: string;
};

const empty: CampaignDraft = {
  campaignId: null,
  status: "draft",
  wizardStep: "basics",
  brandProfileId: null,
  coverImageUrl: "",
  title: "",
  category: "",
  platforms: ["instagram_reel"],
  locationType: "pan_india",
  targetStates: [],
  startDate: "",
  briefHook: "",
  doRules: "",
  avoidRules: "",
  sourceAssets: [],
  sourceVideoRequirement: "mandatory",
  sourceAudioRequirement: "not_required",
  referenceAssets: [],
  brief: "",
  productUrl: "",
  ratePer1kRupees: "50",
  maxPayoutRupees: "50000",
  budgetRupees: "100000",
};

type WizardContext = {
  draft: CampaignDraft;
  paths: WizardPaths;
  loading: boolean;
  saving: boolean;
  loadError: string | null;
  update: (patch: Partial<CampaignDraft>) => void;
  saveNow: (wizardStep?: string) => Promise<string | null>;
  reset: () => void;
};

const WizardContext = createContext<WizardContext | null>(null);

export function CampaignWizardProvider({
  editCampaignId,
  children,
}: {
  editCampaignId?: string;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const { getToken } = useAuth();
  const role = usePortalRole();
  const isAdmin = role === "admin";
  const [draft, setDraft] = useState<CampaignDraft>(empty);
  const [loading, setLoading] = useState(Boolean(editCampaignId));
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const paths = useMemo(
    () => getWizardPaths(editCampaignId ?? draft.campaignId, isAdmin),
    [editCampaignId, draft.campaignId, isAdmin],
  );

  const currentStep = useMemo(() => {
    const p = location.pathname;
    if (p.endsWith("/brief")) return "brief";
    if (p.endsWith("/payout")) return "payout";
    if (p.endsWith("/review")) return "review";
    return "basics";
  }, [location.pathname]);

  useEffect(() => {
    if (!editCampaignId) return;

    let cancelled = false;
    async function loadCampaign() {
      const campaignId = editCampaignId as string;
      const token = getToken();
      if (!token) {
        if (!cancelled) {
          setLoadError("Your session expired. Please log in again.");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setLoadError(null);
      try {
        const campaign = await portalApi.campaigns.get(token, campaignId);
        if (!cancelled) {
          setDraft(campaignToDraft(campaign));
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof ApiError
              ? error.message
              : "Could not load campaign draft.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadCampaign();
    return () => {
      cancelled = true;
    };
  }, [editCampaignId, getToken, isAdmin]);

  useEffect(() => {
    const campaignId = editCampaignId ?? draft.campaignId;
    if (campaignId) joinCampaignRoom(campaignId);
    return () => {
      if (campaignId) leaveCampaignRoom(campaignId);
    };
  }, [editCampaignId, draft.campaignId]);

  const persistDraft = useCallback(
    async (wizardStep?: string): Promise<string | null> => {
      const token = getToken();
      if (!token) return null;

      const current = draftRef.current;
      const title = current.title.trim();
      if (!title) return current.campaignId;

      setSaving(true);
      try {
        // Preserve whatever status the campaign already has (draft/live/paused) —
        // only the explicit "Publish" action should move a campaign into "live".
        const body = {
          ...buildCampaignBody(current, current.status),
          wizardStep: wizardStep ?? currentStep,
        };

        if (current.campaignId) {
          const updated = await portalApi.campaigns.update(token, current.campaignId, body);
          // Server enforces monotonic progress (never regresses), so always
          // trust its response over what we optimistically sent.
          setDraft((d) => ({ ...d, wizardStep: updated.wizardStep }));
          return current.campaignId;
        }

        const created = await portalApi.campaigns.create(token, body);
        setDraft((d) => ({
          ...d,
          campaignId: created.id,
          ownership: created.ownership,
          inviteAcceptedAt: created.inviteAcceptedAt,
          wizardStep: created.wizardStep,
        }));
        // Update the address bar in place (no React Router navigation) so a
        // background auto-save never remounts the page mid-typing — refresh
        // or bookmark still lands on the right campaign, but nothing here
        // interrupts what the user is doing right now.
        if (!editCampaignId) {
          const editBase = isAdmin
            ? `/admin/campaigns/${created.id}/edit`
            : `/campaigns/${created.id}/edit`;
          const suffix = location.pathname.includes("/brief")
            ? "/brief"
            : location.pathname.includes("/payout")
              ? "/payout"
              : location.pathname.includes("/review")
                ? "/review"
                : "";
          window.history.replaceState(null, "", `${editBase}${suffix}`);
        }
        return created.id;
      } finally {
        setSaving(false);
      }
    },
    [getToken, currentStep, editCampaignId, isAdmin, location.pathname],
  );

  const scheduleSave = useCallback(
    (wizardStep?: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void persistDraft(wizardStep);
      }, 500);
    },
    [persistDraft],
  );

  const update = useCallback(
    (patch: Partial<CampaignDraft>) => {
      setDraft((d) => {
        const next = { ...d, ...patch };
        draftRef.current = next;
        return next;
      });
      // Debounced auto-save from the very first edit — persistDraft() itself
      // won't create a row until there's a non-empty title, so this can't
      // spam empty drafts from idle clicking.
      scheduleSave();
    },
    [scheduleSave],
  );

  const saveNow = useCallback(
    async (wizardStep?: string) => persistDraft(wizardStep),
    [persistDraft],
  );

  const reset = useCallback(() => {
    setDraft(empty);
  }, []);

  const value = useMemo(
    () => ({
      draft,
      paths,
      loading,
      saving,
      loadError,
      update,
      saveNow,
      reset,
    }),
    [draft, paths, loading, saving, loadError, update, saveNow, reset],
  );

  return (
    <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
  );
}

export function useCampaignWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) {
    throw new Error("useCampaignWizard requires CampaignWizardProvider");
  }
  return ctx;
}
