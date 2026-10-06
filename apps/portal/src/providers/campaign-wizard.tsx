import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useBlocker, useLocation, useNavigate } from "react-router-dom";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { campaignToDraft } from "@/features/campaigns/lib/campaign-from-api";
import { buildCampaignBody } from "@/features/campaigns/lib/campaign-payload";
import type { ReferenceAsset } from "@/features/campaigns/lib/reference-assets";
import { SaveQueue } from "@/features/campaigns/lib/save-queue";
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
  /** For admin/staff review; filled when loading an existing campaign. */
  brandCompanyName?: string | null;
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

export type WizardStepName = CampaignDraft["wizardStep"];

export type DraftPatch =
  | Partial<CampaignDraft>
  | ((current: CampaignDraft) => Partial<CampaignDraft>);

/** "saving" while any save is queued or running; "error" until the next
 * successful save. */
export type SaveState = "idle" | "saving" | "saved" | "error";

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

const AUTO_SAVE_DELAY_MS = 500;

/** Wizard URLs share one provider; anything else is leaving the wizard. */
const WIZARD_PATH = /^\/(?:admin\/)?campaigns\/(?:new|[^/]+\/edit)(?:\/|$)/;

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return fallback;
}

type WizardContext = {
  draft: CampaignDraft;
  paths: WizardPaths;
  loading: boolean;
  /** True while any save is queued or in flight. */
  saving: boolean;
  saveState: SaveState;
  saveError: string | null;
  loadError: string | null;
  /** Drafts auto-save as you type. A live/paused/closed campaign is shown
   * to creators, so its edits wait for an explicit, confirmed "Save changes". */
  autoSave: boolean;
  /** Unsaved edits on a non-draft campaign. */
  dirty: boolean;
  update: (patch: DraftPatch) => void;
  /** Saves right away (skipping the debounce), in order with other saves. */
  saveNow: (wizardStep?: WizardStepName) => Promise<string | null>;
  /** Saves (drafts only), then moves to `step` of this campaign. */
  goToStep: (step: WizardStepName) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Saves everything and sets the campaign live, after any queued saves. */
  publish: () => Promise<{ id: string }>;
  /** Opens the confirm-then-save dialog for a non-draft campaign. */
  requestSaveLiveChanges: () => void;
  retrySave: () => void;
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
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const role = usePortalRole();
  const isAdmin = role === "admin";

  const [draft, setDraftState] = useState<CampaignDraft>(empty);
  const [loading, setLoading] = useState(Boolean(editCampaignId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmLiveSave, setConfirmLiveSave] = useState(false);
  const [savingLive, setSavingLive] = useState(false);

  // The ref is the source of truth for the draft; state mirrors it for
  // rendering. Every change goes through setDraft() so a save that starts
  // later always sees the newest values, and a server response merging in
  // (new id, wizardStep) can't be overwritten by a keystroke that raced it.
  const draftRef = useRef<CampaignDraft>(empty);
  const setDraft = useCallback((next: CampaignDraft) => {
    draftRef.current = next;
    setDraftState(next);
  }, []);
  const patchDraft = useCallback(
    (patch: Partial<CampaignDraft>) => setDraft({ ...draftRef.current, ...patch }),
    [setDraft],
  );

  // Set the moment a create returns — before React re-renders — so the very
  // next save already updates instead of creating a second campaign.
  const campaignIdRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevEditIdRef = useRef<string | undefined>(undefined);
  // getToken's identity changes on every token refresh; reading it through a
  // ref keeps that from re-running the load effect (which used to reload the
  // campaign from the server mid-edit and throw away unsaved typing).
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;
  const editCampaignIdRef = useRef(editCampaignId);
  editCampaignIdRef.current = editCampaignId;

  const currentStep: WizardStepName = useMemo(() => {
    const p = location.pathname;
    if (p.endsWith("/brief")) return "brief";
    if (p.endsWith("/payout")) return "payout";
    if (p.endsWith("/review")) return "review";
    return "basics";
  }, [location.pathname]);
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  const queue = useMemo(
    () =>
      new SaveQueue(({ pending, error }) => {
        if (pending > 0) {
          setSaveState("saving");
        } else if (error) {
          setSaveState("error");
          setSaveError(errorMessage(error, "Couldn't save your changes."));
        } else {
          setSaveState("saved");
          setSaveError(null);
        }
      }),
    [],
  );

  const paths = useMemo(
    () => getWizardPaths(editCampaignId ?? draft.campaignId, isAdmin),
    [editCampaignId, draft.campaignId, isAdmin],
  );

  const clearSaveTimer = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, []);

  /** One save, run inside the queue. Reads the newest draft when it starts. */
  const runSave = useCallback(
    async (opts: { wizardStep?: WizardStepName; publish?: boolean }): Promise<string | null> => {
      const token = getTokenRef.current();
      if (!token) throw new Error("Your session expired. Please log in again.");

      const current = draftRef.current;
      const id = campaignIdRef.current;
      // No row is created until there's a title (the Basics step requires it).
      if (!id && !current.title.trim()) return null;

      // Status is never sent by an ordinary save: the local copy can be
      // stale (paused from another tab, say), and re-sending it would undo
      // that. Only publish() moves a campaign to live.
      const { status: _status, ...body } = buildCampaignBody(current, current.status);
      // A cleared name isn't saved (the campaign keeps its last name and the
      // Basics step shows "Campaign name is required") — everything else is.
      if (!current.title.trim()) delete body.title;
      const payload: Record<string, unknown> = {
        ...body,
        wizardStep: opts.wizardStep ?? currentStepRef.current,
        ...(opts.publish ? { status: "live" } : {}),
      };

      if (id) {
        const updated = await portalApi.campaigns.update(token, id, payload);
        // The server's view of progress and status always wins.
        patchDraft({
          wizardStep: updated.wizardStep,
          status: updated.status as CampaignDraft["status"],
        });
        return id;
      }

      const created = await portalApi.campaigns.create(token, payload);
      campaignIdRef.current = created.id;
      patchDraft({
        campaignId: created.id,
        ownership: created.ownership,
        inviteAcceptedAt: created.inviteAcceptedAt,
        wizardStep: created.wizardStep,
        status: created.status as CampaignDraft["status"],
        brandProfileId: created.brandProfileId,
      });
      // Put the new campaign's id in the URL (through the router, so it
      // stays in sync) — a refresh then reopens this campaign instead of an
      // empty "new" wizard that would create a duplicate.
      if (!editCampaignIdRef.current) {
        const step = currentStepRef.current;
        const target = getWizardPaths(created.id, isAdminRef.current)[step];
        navigate(target, { replace: true });
      }
      return created.id;
    },
    [navigate, patchDraft],
  );

  const saveNow = useCallback(
    (wizardStep?: WizardStepName) => {
      clearSaveTimer();
      return queue.run(() => runSave({ wizardStep }));
    },
    [clearSaveTimer, queue, runSave],
  );

  const scheduleSave = useCallback(() => {
    clearSaveTimer();
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      // Failures surface through saveState/saveError (and the save bar).
      queue.run(() => runSave({})).catch(() => undefined);
    }, AUTO_SAVE_DELAY_MS);
  }, [clearSaveTimer, queue, runSave]);

  const update = useCallback(
    (patchOrFn: DraftPatch) => {
      // A function receives the LATEST draft — needed by anything that
      // finishes later (an upload) and must not overwrite edits made since.
      patchDraft(typeof patchOrFn === "function" ? patchOrFn(draftRef.current) : patchOrFn);
      if (draftRef.current.status === "draft") {
        scheduleSave();
      } else {
        // Live campaigns: every keystroke must NOT go straight to creators.
        setDirty(true);
      }
    },
    [patchDraft, scheduleSave],
  );

  // Load (or switch) the campaign being edited.
  useEffect(() => {
    if (!editCampaignId) {
      // Went from editing a campaign back to "new": start from a blank draft.
      if (prevEditIdRef.current) {
        clearSaveTimer();
        campaignIdRef.current = null;
        setDraft(empty);
        setDirty(false);
      }
      prevEditIdRef.current = undefined;
      setLoading(false);
      return;
    }
    prevEditIdRef.current = editCampaignId;

    // Already in memory — typically the campaign this wizard just created,
    // whose URL we switched to. Reloading would drop unsaved typing.
    if (campaignIdRef.current === editCampaignId) {
      setLoading(false);
      return;
    }

    // Switching campaigns: save the old one's pending edits to the old id first.
    if (saveTimer.current) {
      clearSaveTimer();
      queue.run(() => runSave({})).catch(() => undefined);
    }

    let cancelled = false;
    (async () => {
      const token = getTokenRef.current();
      if (!token) {
        setLoadError("Your session expired. Please log in again.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);
      try {
        await queue.idle();
        const campaign = await portalApi.campaigns.get(token, editCampaignId);
        if (cancelled) return;
        campaignIdRef.current = campaign.id;
        setDraft(campaignToDraft(campaign));
        setDirty(false);
      } catch (error) {
        if (!cancelled) setLoadError(errorMessage(error, "Could not load campaign draft."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only the campaign id drives (re)loading — see getTokenRef above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editCampaignId]);

  // Leaving the wizard with a draft save still waiting on its debounce:
  // send it now rather than drop the last half-second of typing.
  useEffect(
    () => () => {
      if (saveTimer.current && draftRef.current.status === "draft") {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        queue.run(() => runSave({})).catch(() => undefined);
      }
    },
    [queue, runSave],
  );

  useEffect(() => {
    const campaignId = editCampaignId ?? draft.campaignId;
    if (campaignId) joinCampaignRoom(campaignId);
    return () => {
      if (campaignId) leaveCampaignRoom(campaignId);
    };
  }, [editCampaignId, draft.campaignId]);

  const goToStep = useCallback(
    async (step: WizardStepName): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (draftRef.current.status === "draft") {
        try {
          await saveNow(step);
        } catch (error) {
          return { ok: false, error: errorMessage(error, "Couldn't save your changes.") };
        }
      }
      // Built from the id we have NOW — not from paths captured before the
      // first save created the campaign.
      navigate(getWizardPaths(campaignIdRef.current, isAdminRef.current)[step]);
      return { ok: true };
    },
    [navigate, saveNow],
  );

  const publish = useCallback(async (): Promise<{ id: string }> => {
    clearSaveTimer();
    const id = await queue.run(() => runSave({ publish: true, wizardStep: "review" }));
    if (!id) throw new Error("Add a campaign name before publishing.");
    setDirty(false);
    return { id };
  }, [clearSaveTimer, queue, runSave]);

  const confirmSaveLiveChanges = useCallback(async () => {
    setSavingLive(true);
    try {
      await queue.run(() => runSave({}));
      setDirty(false);
      setConfirmLiveSave(false);
    } catch {
      // saveError carries the reason; keep the dialog open to retry.
    } finally {
      setSavingLive(false);
    }
  }, [queue, runSave]);

  const retrySave = useCallback(() => {
    if (draftRef.current.status === "draft") {
      saveNow().catch(() => undefined);
    } else {
      setConfirmLiveSave(true);
    }
  }, [saveNow]);

  const reset = useCallback(() => {
    clearSaveTimer();
    campaignIdRef.current = null;
    setDraft(empty);
    setDirty(false);
    setSaveState("idle");
    setSaveError(null);
  }, [clearSaveTimer, setDraft]);

  // Unsaved work is: live-campaign edits not yet confirmed, or a draft save
  // that failed. Moving between wizard steps is fine (state is kept here);
  // leaving the wizard asks first.
  const hasUnsavedWork = dirty || saveState === "error";
  const blocker = useBlocker(
    ({ nextLocation }) => hasUnsavedWork && !WIZARD_PATH.test(nextLocation.pathname),
  );
  useEffect(() => {
    if (!hasUnsavedWork && saveState !== "saving") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedWork, saveState]);

  const autoSave = draft.status === "draft";
  const value = useMemo(
    () => ({
      draft,
      paths,
      loading,
      saving: saveState === "saving",
      saveState,
      saveError,
      loadError,
      autoSave,
      dirty,
      update,
      saveNow,
      goToStep,
      publish,
      requestSaveLiveChanges: () => setConfirmLiveSave(true),
      retrySave,
      reset,
    }),
    [draft, paths, loading, saveState, saveError, loadError, autoSave, dirty, update, saveNow, goToStep, publish, retrySave, reset],
  );

  return (
    <WizardContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={confirmLiveSave}
        title={`Save changes to this ${draft.status} campaign?`}
        description={
          saveError && !savingLive
            ? `Couldn't save: ${saveError}`
            : "Creators see these changes as soon as you save."
        }
        confirmLabel="Save changes"
        loading={savingLive}
        onConfirm={() => void confirmSaveLiveChanges()}
        onCancel={() => setConfirmLiveSave(false)}
      />
      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Leave without saving?"
        description={
          dirty
            ? "Your changes to this campaign haven't been saved. Creators still see the previous version."
            : "Some of your latest changes couldn't be saved and will be lost."
        }
        confirmLabel="Discard changes"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </WizardContext.Provider>
  );
}

export function useCampaignWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) {
    throw new Error("useCampaignWizard requires CampaignWizardProvider");
  }
  return ctx;
}
