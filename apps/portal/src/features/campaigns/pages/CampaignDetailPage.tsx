import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { BackButton } from "@/components/ui/back-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { DetailPageSkeleton } from "@/components/ui/page-skeletons";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toaster";
import { UploadProgressView } from "@/components/ui/upload-progress";
import {
  ClipperProfileGrid,
  ClipperProfileModal,
  CreatorAvatar,
  Leaderboard,
  LinkCard,
  MediaPreview,
  reviewSectionFor,
  StageTag,
  StatusBoard,
  SubmissionGrid,
  useEscape,
  type ReviewSection,
} from "@/features/campaigns/components/campaign-board-widgets";
import { CampaignReviewBanner } from "@/features/campaigns/components/campaign-review-banner";
import { useCampaign, useUpdateCampaignAutoReview, useUpdateCampaignStatus } from "@/features/campaigns/hooks/use-campaigns";
import {
  actorSentence,
  approvedEarningsPaise,
  buildClipperProfiles,
  buildCreatorPerformance,
  formatCount,
  formatDate,
  formatDateTime,
} from "@/features/campaigns/lib/campaign-board-data";
import { campaignStatusLabel, isLockedForReview } from "@/features/campaigns/lib/campaign-status";
import {
  countBy,
  deliverableStage,
  isProofStatus,
  proofOutcome,
  STAGE_ORDER,
  TAG_META,
  workOutcome,
  type Stage,
  type Tag,
} from "@/features/campaigns/lib/clipper-stage";
import { formatPlatformLabel, formatPlatformList } from "@/features/campaigns/lib/platform-labels";
import { parseRulePoints } from "@/features/campaigns/lib/rule-points";
import { getWizardEditPath } from "@/features/campaigns/lib/wizard-paths";
import { CreatorProfileModal } from "@/features/creators/components/CreatorProfileModal";
import { useSubmission } from "@/features/submissions/hooks/use-submissions";
import { adminApi, downloadBlob, portalApi, ApiError, type AutoReviewResult, type Campaign, type CampaignCreatorPayout, type UploadProgress } from "@/lib/api";
import { formatInr } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";
import { useAuth, usePortalRole } from "@/providers/auth-provider";

import { isOnDomain } from "@/lib/link-host";
type Tab = "overview" | "clippers" | "board" | "submissions" | "proof" | "analytics" | "payouts";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",    label: "Overview" },
  { id: "clippers",    label: "Working Clippers" },
  { id: "board",       label: "Status Board" },
  { id: "submissions", label: "Work Submissions" },
  { id: "proof",       label: "Proof of Work" },
  { id: "analytics",   label: "Analytics" },
];

const CAMPAIGN_STATUS_STYLE: Record<string, string> = {
  live:   "bg-emerald-500 text-white",
  draft:  "bg-zinc-600 text-white",
  pending_review: "bg-indigo-500 text-white",
  paused: "bg-orange-500 text-white",
  closed: "bg-red-600 text-white",
};

/* ── Admin override: open intake for N more clippers past the pool threshold ── */

function ClipperIntakeDialog({
  open,
  loading,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  loading: boolean;
  onSubmit: (extraClipperAllowance: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("5");
  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= 0;

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close dialog"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clipper-intake-title"
        className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl"
      >
        <h2 id="clipper-intake-title" className="text-lg font-bold text-foreground">
          Open slots for more clippers
        </h2>
        <p className="mt-2 text-sm text-muted">
          This campaign's pool crossed its intake threshold, so new clippers are currently
          blocked from joining. Set how many extra clippers can join past that point — set it
          back to 0 to close intake again.
        </p>
        <label className="mt-4 block text-xs font-semibold text-muted" htmlFor="extra-clipper-allowance">
          Extra clippers allowed
        </label>
        <Input
          id="extra-clipper-allowance"
          type="number"
          min={0}
          step={1}
          className="mt-1.5"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-primary"
            onClick={() => valid && onSubmit(parsed)}
            disabled={loading || !valid}
          >
            {loading ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Work Submissions / Proof of Work review window ──
   Opens on one step — the work, or the proof of work — and shows only that
   step's media, dates, rejection reason and actions. A switch at the top
   moves between the two for the same clipper, so nothing from one step is
   ever approved while looking at the other. */

const REJECT_REASON_MAX = 500;

function SubmissionDetailModal({
  deliverableId,
  section: initialSection,
  readOnly,
  onClose,
}: {
  deliverableId: string;
  section: ReviewSection;
  /** View-only team member: show everything, offer no actions. */
  readOnly: boolean;
  onClose: () => void;
}) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [section, setSectionState] = useState<ReviewSection>(initialSection);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showCreatorProfile, setShowCreatorProfile] = useState(false);
  const [confirmApproveProof, setConfirmApproveProof] = useState(false);
  const adminDraftInputRef = useRef<HTMLInputElement>(null);
  useEscape(onClose, !showCreatorProfile && !confirmApproveProof);

  const { data: d, isPending } = useSubmission(deliverableId);

  function setSection(next: ReviewSection) {
    setSectionState(next);
    setShowRejectForm(false);
    setRejectReason("");
  }

  function invalidateAfterReview() {
    void queryClient.invalidateQueries({ queryKey: ["submission", "deliverable", deliverableId] });
    void queryClient.invalidateQueries({ queryKey: ["campaign-deliverables"] });
    void queryClient.invalidateQueries({ queryKey: ["campaign-payouts"] });
    setShowRejectForm(false);
    setRejectReason("");
  }

  const reviewMutation = useMutation({
    mutationFn: (body: { action: "approve" | "reject"; rejectionReason?: string }) =>
      portalApi.submissions.review(getToken()!, deliverableId, body),
    onSuccess: (_res, body) => {
      invalidateAfterReview();
      toast(body.action === "approve" ? "Work approved — the clipper can post it live now" : "Work rejected — the clipper will be notified");
    },
    onError: (err) => {
      invalidateAfterReview();
      toast(err instanceof ApiError ? err.message : "Review failed", "error");
    },
  });

  const approveProofMutation = useMutation({
    mutationFn: () => portalApi.submissions.approveProof(getToken()!, deliverableId),
    onSuccess: () => {
      setConfirmApproveProof(false);
      invalidateAfterReview();
      toast("Proof of work approved — the clipper is now waiting for payment");
    },
    onError: (err) => {
      setConfirmApproveProof(false);
      invalidateAfterReview();
      toast(err instanceof ApiError ? err.message : "Approval failed", "error");
    },
  });

  const rejectProofMutation = useMutation({
    mutationFn: () => portalApi.submissions.rejectProof(getToken()!, deliverableId, rejectReason.trim()),
    onSuccess: () => {
      invalidateAfterReview();
      toast("Proof of work rejected — the clipper will be notified");
    },
    onError: (err) => {
      invalidateAfterReview();
      toast(err instanceof ApiError ? err.message : "Rejection failed", "error");
    },
  });

  const [draftCopyProgress, setDraftCopyProgress] = useState<UploadProgress | null>(null);
  const uploadAdminDraftMutation = useMutation({
    mutationFn: (file: File) => {
      setDraftCopyProgress(null);
      return portalApi.submissions.uploadAdminDraftCopy(getToken()!, deliverableId, file, setDraftCopyProgress);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["submission", "deliverable", deliverableId] });
      toast("Uploaded — automated review will check this now");
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Upload failed", "error"),
  });

  const refreshViewsMutation = useMutation({
    mutationFn: () => portalApi.submissions.refreshViews(getToken()!, deliverableId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["submission", "deliverable", deliverableId] });
      void queryClient.invalidateQueries({ queryKey: ["campaign-deliverables"] });
      toast("Views refreshed");
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Could not refresh views", "error"),
  });

  const isMutating =
    reviewMutation.isPending ||
    approveProofMutation.isPending ||
    rejectProofMutation.isPending ||
    uploadAdminDraftMutation.isPending;

  const hasProof = Boolean(d && isProofStatus(d.status));
  const tag: Tag | null = d ? (section === "submissions" ? workOutcome(d) : proofOutcome(d)) : null;
  const canReviewDraft = !readOnly && section === "submissions" && d?.status === "under_review";
  const canReviewProof =
    !readOnly && section === "proof" && (d?.status === "proof_under_review" || d?.status === "live_submitted");
  const canReview = canReviewDraft || canReviewProof;
  // rejectionReason belongs to whichever step was rejected last.
  const rejectionHere =
    d?.rejectionReason &&
    ((section === "submissions" && d.status === "draft_rejected") || (section === "proof" && d.status === "proof_rejected"))
      ? d.rejectionReason
      : null;
  const canRefreshViews =
    section === "proof" &&
    Boolean(d?.livePostUrl) &&
    (d?.status === "live_submitted" || d?.status === "proof_under_review" || d?.status === "proof_approved");
  const submittedAt = section === "submissions" ? d?.draftSubmittedAt : d?.liveSubmittedAt;
  const reviewedAt = section === "submissions" ? d?.draftReviewedAt : d?.proofReviewedAt;
  const stepName = section === "submissions" ? "work" : "proof";
  // Who made the latest decision on this step (an admin or a team member).
  const reviewer = (section === "submissions" ? d?.workReviewedBy : d?.proofReviewedBy) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-4" onClick={onClose}>
      {showCreatorProfile && d && (
        <CreatorProfileModal creatorId={d.creator.id} onClose={() => setShowCreatorProfile(false)} />
      )}
      <ConfirmDialog
        open={confirmApproveProof}
        title="Approve this proof of work?"
        description="You're confirming the live post is genuine and follows the brief. The clipper becomes eligible for payment based on its views."
        confirmLabel="Approve proof"
        loading={approveProofMutation.isPending}
        onConfirm={() => approveProofMutation.mutate()}
        onCancel={() => setConfirmApproveProof(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={section === "submissions" ? "Work submission" : "Proof of work"}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold">{section === "submissions" ? "Work submission" : "Proof of work"}</h2>
            {tag && <StageTag tag={tag} />}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-border bg-surface-variant/40 p-0.5 text-xs font-semibold">
              {(["submissions", "proof"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={s === "proof" && !hasProof}
                  onClick={() => setSection(s)}
                  title={s === "proof" && !hasProof ? "No live post submitted yet" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    section === s ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
                  )}
                >
                  {s === "submissions" ? "Work" : "Proof of work"}
                </button>
              ))}
            </div>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-muted hover:bg-surface-variant hover:text-foreground">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {isPending || !d ? (
          <div className="flex-1 p-10 text-center text-sm text-muted">Loading…</div>
        ) : (
          <div className="grid flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[260px_1fr_280px]">
            {/* LEFT — campaign + creator */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface-variant/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Clipper</p>
                <div className="mt-3 flex items-center gap-3">
                  <CreatorAvatar
                    name={d.creator.displayName ?? d.creator.username ?? "C"}
                    url={d.creatorProfile?.avatarUrl}
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{d.creator.displayName ?? d.creator.username ?? "Creator"}</p>
                    {d.creator.username && <p className="truncate text-xs text-muted">@{d.creator.username}</p>}
                  </div>
                </div>
                {d.creatorProfile && (
                  <div className="mt-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Submitted as</p>
                    <p className="mt-1 text-sm font-semibold text-primary">@{d.creatorProfile.handle}</p>
                    <p className="text-[11px] capitalize text-muted">
                      {formatPlatformLabel(d.platform)}
                      {d.creatorProfile.label ? ` · ${d.creatorProfile.label}` : ""}
                    </p>
                  </div>
                )}
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setShowCreatorProfile(true)}>
                  View profile
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-surface-variant/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Campaign</p>
                <p className="mt-2 font-bold">{d.campaign.title}</p>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Status</span>
                    <StatusPill status={d.campaign.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Rate</span>
                    <span className="font-medium">{d.campaign.ratePer1kDisplay}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Budget</span>
                    <span className="font-medium">{formatInr(d.campaign.budgetPaise)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* MIDDLE — this step's media */}
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span>
                  {submittedAt
                    ? `${section === "submissions" ? "Work submitted" : "Live post submitted"} ${formatDate(submittedAt)}`
                    : "Not submitted yet"}
                </span>
                {reviewedAt && !canReview && (
                  <span>
                    {reviewer ? (
                      <>
                        <span className="font-semibold text-foreground">{actorSentence(reviewer)}</span> · {formatDate(reviewedAt)}
                      </>
                    ) : (
                      `Reviewed ${formatDate(reviewedAt)}`
                    )}
                  </span>
                )}
              </div>

              {section === "submissions" ? (
                d.draftDriveUrl ? (
                  <MediaPreview label="Submitted work" url={d.draftDriveUrl} />
                ) : (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-10 text-sm text-muted">
                    No work submitted yet
                  </div>
                )
              ) : d.livePostUrl ? (
                <>
                  <MediaPreview label="Live post" url={d.livePostUrl} />
                  {/* Embeds can fail (private account, removed post) — the link always works. */}
                  <LinkCard label="Open the live post" url={d.livePostUrl} />
                </>
              ) : (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-10 text-sm text-muted">
                  No live post submitted yet
                </div>
              )}

              {rejectionHere && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
                  <p className="text-sm font-semibold text-destructive">
                    Why the {section === "submissions" ? "work" : "proof of work"} was rejected
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm">{rejectionHere}</p>
                </div>
              )}

              {/* Work that already moved on — point to where it went. */}
              {section === "submissions" && tag === "work_approved" && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-variant/50 p-4 text-sm">
                  <span className="text-muted">
                    {hasProof
                      ? "This work was approved and the clipper has posted it live."
                      : "This work was approved — waiting for the clipper to post it live."}
                  </span>
                  {hasProof && (
                    <Button size="sm" variant="outline" onClick={() => setSection("proof")}>
                      Open proof of work
                    </Button>
                  )}
                </div>
              )}

              {section === "proof" && d.livePostUrl && (
                <div className="rounded-xl border border-border bg-surface-variant/50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Performance</p>
                    {canRefreshViews && (
                      <button
                        type="button"
                        onClick={() => refreshViewsMutation.mutate()}
                        disabled={refreshViewsMutation.isPending}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground disabled:opacity-60"
                      >
                        <svg
                          className={cn("h-3.5 w-3.5", refreshViewsMutation.isPending && "animate-spin")}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {refreshViewsMutation.isPending ? "Refreshing…" : "Refresh views"}
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
                    {[
                      { label: "Views", value: formatCount(d.viewCount) },
                      { label: "Likes", value: formatCount(d.likeCount) },
                      { label: "Comments", value: formatCount(d.commentCount) },
                      { label: "Shares", value: formatCount(d.shareCount) },
                      { label: "Earning", value: formatInr(d.estimatedPaise) },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg border border-border bg-surface px-3 py-2 text-center">
                        <p className="text-lg font-black">{value}</p>
                        <p className="text-[10px] text-muted">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-muted">
                    Views sync automatically every few minutes — refresh here if you need the latest number right now.
                  </p>
                </div>
              )}

              {section === "proof" && d.draftDriveUrl && (
                <LinkCard label="Approved work (to compare with the live post)" url={d.draftDriveUrl} />
              )}

              {section === "submissions" && !readOnly && d.draftDriveUrl && isOnDomain(d.draftDriveUrl, "drive.google.com") && (
                <div className="rounded-xl border border-border bg-surface-variant/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Automated review</p>
                  <p className="mt-1.5 text-sm text-muted">
                    {d.adminUploadedDraftUrl
                      ? "A copy is on file — automated review can check this submission."
                      : "This is a Google Drive link — automated review can't fetch it directly. Download it from the Drive link above, then upload a copy here."}
                  </p>
                  {uploadAdminDraftMutation.isPending && (
                    <div className="mt-3 max-w-sm rounded-lg border border-border bg-surface px-3 py-2.5">
                      <UploadProgressView progress={draftCopyProgress} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => adminDraftInputRef.current?.click()}
                    disabled={uploadAdminDraftMutation.isPending}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-variant disabled:opacity-60"
                  >
                    {uploadAdminDraftMutation.isPending
                      ? "Uploading…"
                      : d.adminUploadedDraftUrl
                        ? "Replace uploaded copy"
                        : "Upload a copy from this device"}
                  </button>
                  <input
                    ref={adminDraftInputRef}
                    type="file"
                    accept="video/*,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadAdminDraftMutation.mutate(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
            </div>

            {/* RIGHT — this step's actions + history */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface-variant/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  {section === "submissions" ? "Review work" : "Review proof of work"}
                </p>
                <div className="mt-3 space-y-3">
                  {canReview && showRejectForm ? (
                    <>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={4}
                        maxLength={REJECT_REASON_MAX}
                        autoFocus
                        placeholder={`What should the clipper fix? They'll see this with the rejected ${stepName}.`}
                        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-right text-[11px] text-muted">
                        {rejectReason.length}/{REJECT_REASON_MAX}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setShowRejectForm(false)} disabled={isMutating}>
                          Back
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          disabled={isMutating || !rejectReason.trim()}
                          onClick={() =>
                            canReviewDraft
                              ? reviewMutation.mutate({ action: "reject", rejectionReason: rejectReason.trim() })
                              : rejectProofMutation.mutate()
                          }
                        >
                          {isMutating ? "Rejecting…" : `Reject ${stepName}`}
                        </Button>
                      </div>
                    </>
                  ) : canReviewDraft ? (
                    <>
                      <Button className="w-full" onClick={() => reviewMutation.mutate({ action: "approve" })} disabled={isMutating}>
                        {reviewMutation.isPending ? "Approving…" : "Approve work"}
                      </Button>
                      <Button variant="destructive" className="w-full" onClick={() => setShowRejectForm(true)} disabled={isMutating}>
                        Reject work
                      </Button>
                    </>
                  ) : canReviewProof ? (
                    <>
                      <Button className="w-full" onClick={() => setConfirmApproveProof(true)} disabled={isMutating}>
                        Approve proof of work
                      </Button>
                      <Button variant="destructive" className="w-full" onClick={() => setShowRejectForm(true)} disabled={isMutating}>
                        Reject proof of work
                      </Button>
                    </>
                  ) : (
                    <div className="rounded-lg bg-surface-variant px-3 py-2.5 text-center text-sm text-muted">
                      {reviewer && !canReview && (
                        <p className="mb-1 font-semibold text-foreground">{actorSentence(reviewer)}</p>
                      )}
                      {readOnly ? "You have view-only access to this brand." : tag ? TAG_META[tag].hint : "Nothing to review yet."}
                    </div>
                  )}
                </div>
              </div>

              {d.reviewTrail && d.reviewTrail.length > 0 && (
                <div className="rounded-xl border border-border bg-surface-variant/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Who did what</p>
                  <ol className="mt-3 space-y-3">
                    {[...d.reviewTrail].reverse().map((entry, i) => (
                      <li key={`${entry.at}-${i}`} className="flex gap-2.5 text-xs">
                        <span
                          className={cn(
                            "mt-1 h-2 w-2 shrink-0 rounded-full",
                            entry.step.endsWith("rejected") ? "bg-red-400" : "bg-emerald-400",
                          )}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold">{actorSentence(entry)}</p>
                          <p className="text-muted">{formatDateTime(entry.at)}</p>
                          {entry.reason && <p className="mt-0.5 text-muted">“{entry.reason}”</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <AutoReviewPanel
                results={d.autoReview}
                stage={section === "proof" ? "proof" : "draft"}
                maxRetries={d.autoReviewMaxRetries}
              />

              {section === "submissions" && d.rejectionHistory.length > 0 && (
                <div className="rounded-xl border border-border bg-surface-variant/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Earlier rejected work</p>
                  <div className="mt-3 space-y-2">
                    {d.rejectionHistory.map((event, i) => (
                      <div key={event.id} className="rounded-lg border border-border bg-surface px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">Attempt {d.rejectionHistory.length - i}</span>
                          <StageTag tag="work_rejected" />
                        </div>
                        <p className="mt-1.5 text-xs">{event.rejectionReason}</p>
                        <p className="mt-1 text-[11px] text-muted">
                          {formatDate(event.rejectedAt)}
                          {event.reviewedByDisplayName ? ` · ${event.reviewedByDisplayName}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Automated review — shadow-mode Gemini pipeline results, purely
   informational (never drives status). Filtered to whichever stage this
   modal is open on (draft submission vs live proof) and shows the most
   recent run expanded, with any earlier attempts (e.g. after a resubmit)
   collapsed below it, same "History" pattern as rejectionHistory. ── */

function AutoReviewPanel({
  results,
  stage,
  maxRetries,
}: {
  results: AutoReviewResult[];
  stage: "draft" | "proof";
  maxRetries: number;
}) {
  const forStage = results.filter((r) => r.stage === stage);
  if (forStage.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-variant/50 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Automated Review</p>
        <p className="mt-2 text-sm text-muted">
          No automated review yet — either it hasn't run for this submission, or it's turned off for this campaign.
        </p>
      </div>
    );
  }

  const [latest, ...earlier] = forStage;
  const attemptsUsed = forStage.length;
  // A needs_review result on its own doesn't say whether the AI is still
  // working this or has stalled — the sweep keeps retrying up to
  // maxRetries attempts (~an hour), then stops for good. This is the only
  // thing that actually tells "still checking" apart from "gave up",
  // which is the whole point of this panel.
  const stillRetrying = latest.decision === "needs_review" && attemptsUsed < maxRetries;
  const gaveUp = latest.decision === "needs_review" && attemptsUsed >= maxRetries;

  return (
    <div className="rounded-xl border border-border bg-surface-variant/50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Automated Review</p>
        {stillRetrying ? (
          <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Checking…
          </span>
        ) : (
          <StatusPill status={latest.decision} />
        )}
      </div>
      <p className="mt-1 text-xs text-muted">
        {formatDate(latest.createdAt)}
        {latest.modelVersion ? ` · ${latest.modelVersion}` : ""}
        {latest.decision === "needs_review" ? ` · attempt ${attemptsUsed} of ${maxRetries}` : ""}
      </p>

      {stillRetrying && (
        <p className="mt-2 rounded-lg bg-primary/10 px-2.5 py-2 text-xs text-primary">
          Still actively checking this — it automatically rechecks every few minutes. This updates live, no need to refresh.
        </p>
      )}
      {gaveUp && (
        <p className="mt-2 rounded-lg bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
          Automated review couldn't reach a decision after {attemptsUsed} attempts — this needs a manual look, it won't resolve on its own.
        </p>
      )}

      <div className="mt-3 space-y-1.5">
        {latest.tier1Results.map((gate, i) => (
          <AutoReviewCheckRow
            key={`t1-${i}`}
            pass={gate.status === "pass"}
            unresolved={gate.status === "unresolved"}
            label={gate.gate.replace(/_/g, " ")}
            reason={gate.reason}
          />
        ))}
        {latest.tier2Results?.map((c) => (
          <AutoReviewCheckRow key={c.criterionId} pass={c.pass} label={c.label} reason={c.reason} />
        ))}
      </div>

      {earlier.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-foreground">
            {earlier.length} earlier attempt{earlier.length > 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-2">
            {earlier.map((r) => (
              <div key={r.id} className="rounded-lg border border-border bg-surface px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
                  <StatusPill status={r.decision} />
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function AutoReviewCheckRow({
  pass,
  unresolved,
  label,
  reason,
}: {
  pass: boolean;
  unresolved?: boolean;
  label: string;
  reason: string;
}) {
  const color = unresolved ? "text-muted" : pass ? "text-money" : "text-destructive";
  const icon = unresolved ? "–" : pass ? "✓" : "✗";
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className={cn("mt-0.5 font-bold", color)}>{icon}</span>
      <div>
        <p className="capitalize text-foreground">{label}</p>
        <p className="text-muted">{reason}</p>
      </div>
    </div>
  );
}

/* ── Payouts (admin only) ── */

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function PayoutsPanel({ campaignId }: { campaignId: string }) {
  const { getToken } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = getToken()!;
  const [confirmTarget, setConfirmTarget] = useState<
    { type: "all" } | { type: "creator"; creatorId: string; creatorProfileId: string; creatorName: string } | null
  >(null);

  const { data: payouts = [], isPending } = useQuery({
    queryKey: ["campaign-payouts", campaignId],
    queryFn: () => adminApi.campaignPayouts(token, campaignId),
    enabled: Boolean(token && campaignId),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["campaign-payouts", campaignId] });
  }

  const payAllMutation = useMutation({
    mutationFn: () => adminApi.payoutAll(token, campaignId),
    onSuccess: (res) => {
      invalidate();
      setConfirmTarget(null);
      toast(res.paidCount > 0 ? `Credited ${formatInr(res.totalPaidPaise)} to creator wallets across ${res.paidCount} deliverable${res.paidCount === 1 ? "" : "s"}` : "Nothing to credit");
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Failed to credit earnings", "error"),
  });

  const payCreatorMutation = useMutation({
    mutationFn: (row: { creatorId: string; creatorProfileId: string }) =>
      adminApi.payoutCreator(token, campaignId, row.creatorId, row.creatorProfileId),
    onSuccess: (res) => {
      invalidate();
      setConfirmTarget(null);
      toast(res.paidCount > 0 ? `Credited ${formatInr(res.totalPaidPaise)} to the creator's wallet` : "Nothing to credit");
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Failed to credit earnings", "error"),
  });

  const isMutating = payAllMutation.isPending || payCreatorMutation.isPending;
  const totalUnpaidPaise = payouts.reduce((sum, p) => sum + p.totalUnpaidPaise, 0);
  const creatorsWithUnpaid = payouts.filter((p) => p.totalUnpaidPaise > 0).length;

  if (isPending) {
    return <div className="h-64 animate-pulse rounded-2xl bg-surface" />;
  }

  if (payouts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface py-16 text-center">
        <p className="font-medium">No approved proof of work yet</p>
        <p className="mt-1 text-sm text-muted">Payouts unlock once you approve proof of work in the Proof of Work tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={confirmTarget !== null}
        title={confirmTarget?.type === "all" ? "Credit all earnings?" : `Credit ${confirmTarget?.type === "creator" ? confirmTarget.creatorName : ""}'s earnings?`}
        description={
          confirmTarget?.type === "all"
            ? `This adds ${formatInr(totalUnpaidPaise)} to the wallets of ${creatorsWithUnpaid} creator${creatorsWithUnpaid === 1 ? "" : "s"}. No money is sent yet — creators can then withdraw it, and you pay those withdrawals from the Payouts page.`
            : `This adds ${formatInr(payouts.find((p) => confirmTarget?.type === "creator" && p.creatorProfileId === confirmTarget.creatorProfileId)?.totalUnpaidPaise ?? 0)} to this creator's wallet. No money is sent yet — they can then withdraw it, and you pay it from the Payouts page.`
        }
        confirmLabel="Credit to wallet"
        loading={isMutating}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => {
          if (confirmTarget?.type === "all") payAllMutation.mutate();
          else if (confirmTarget?.type === "creator") payCreatorMutation.mutate(confirmTarget);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Unpaid earnings</p>
          <p className="mt-1 text-2xl font-black">{formatInr(totalUnpaidPaise)}</p>
          <p className="mt-0.5 text-xs text-muted">{creatorsWithUnpaid} creator{creatorsWithUnpaid === 1 ? "" : "s"} awaiting payout</p>
        </div>
        <Button disabled={totalUnpaidPaise === 0 || isMutating} onClick={() => setConfirmTarget({ type: "all" })}>
          Credit all to wallets
        </Button>
      </div>

      <div className="space-y-3">
        {payouts.map((p: CampaignCreatorPayout) => (
          <div key={p.creatorProfileId} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-black text-primary">
                {initials(p.creatorName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.creatorName}</p>
                <p className="truncate text-[11px] text-muted">@{p.handle}</p>
                <p className="text-xs text-muted">
                  {formatInr(p.totalApprovedPaise)} approved · {formatInr(p.totalPaidPaise)} credited
                </p>
              </div>
              {p.totalUnpaidPaise > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isMutating}
                  onClick={() =>
                    setConfirmTarget({
                      type: "creator",
                      creatorId: p.creatorId,
                      creatorProfileId: p.creatorProfileId,
                      creatorName: p.creatorName,
                    })
                  }
                >
                  Credit {formatInr(p.totalUnpaidPaise)}
                </Button>
              ) : (
                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                  Fully credited
                </span>
              )}
            </div>

            <div className="mt-3 divide-y divide-border/50 border-t border-border/50">
              {p.deliverables.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="capitalize text-muted">{d.platform.replace(/_/g, " ")}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatInr(d.paidAmountPaise ?? d.earnedPaise)}</span>
                    {d.paidAt ? (
                      <StageTag tag="paid" />
                    ) : d.earnedPaise > 0 ? (
                      <StageTag tag="awaiting_payment" />
                    ) : (
                      <span className="text-xs text-muted" title="Nothing to pay until the post gets views">
                        No views yet
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Overview ── */

const REQUIREMENT_LABEL: Record<string, string> = {
  mandatory: "Must use",
  optional: "Optional",
  not_required: "Not needed",
};

/** Start dates are stored as the day at UTC midnight — read them in UTC so
 * the day never shifts with the viewer's timezone. */
function formatStartDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function RuleList({ title, tone, text }: { title: string; tone: "do" | "avoid"; text: string | null }) {
  const points = parseRulePoints(text ?? "");
  if (points.length === 0) return null;
  const color = tone === "do" ? "text-emerald-500" : "text-destructive";
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className={cn("text-xs font-semibold uppercase tracking-wider", color)}>{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {points.map((point) => (
          <li key={point.id} className="flex gap-2">
            <span className={cn("mt-0.5 shrink-0 font-bold", color)}>{tone === "do" ? "✓" : "✕"}</span>
            <span className="whitespace-pre-wrap">{point.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CampaignOverview({ campaign }: { campaign: Campaign }) {
  const structured = Boolean(campaign.briefHook || campaign.doRules || campaign.avoidRules);
  const facts: Array<{ label: string; value: string }> = [
    { label: "Pay rate", value: campaign.ratePer1kDisplay },
    { label: "Max payout per clip", value: formatInr(campaign.maxPayoutPaise) },
    { label: "Budget", value: formatInr(campaign.budgetPaise) },
    { label: "Start date", value: campaign.startDate ? formatStartDay(campaign.startDate) : "Not set" },
    { label: "Formats", value: formatPlatformList(campaign.platforms ?? []) || "—" },
    {
      label: "Location",
      value:
        campaign.locationType === "states" && campaign.targetStates.length > 0
          ? campaign.targetStates.join(", ")
          : "All of India",
    },
    { label: "Category", value: campaign.category || "Not set" },
    { label: "Source video", value: REQUIREMENT_LABEL[campaign.sourceVideoRequirement] ?? "—" },
    { label: "Source audio", value: REQUIREMENT_LABEL[campaign.sourceAudioRequirement] ?? "—" },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-5">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Campaign brief</p>
          {structured ? (
            campaign.briefHook && (
              <>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-primary">Hook</p>
                <p className="mt-1 whitespace-pre-wrap text-base font-semibold leading-relaxed">{campaign.briefHook}</p>
              </>
            )
          ) : (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{campaign.brief || "No brief added yet."}</p>
          )}
          {campaign.productUrl && (
            <a
              href={campaign.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              Product page →
            </a>
          )}
        </div>

        {structured && (
          <div className="grid gap-4 md:grid-cols-2">
            <RuleList title="Do" tone="do" text={campaign.doRules} />
            <RuleList title="Avoid" tone="avoid" text={campaign.avoidRules} />
          </div>
        )}

        {campaign.referenceAssets && campaign.referenceAssets.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Sample content</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {campaign.referenceAssets.map((asset, i) => (
                <a
                  key={`${asset.url}-${i}`}
                  href={resolveMediaUrl(asset.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group overflow-hidden rounded-xl border border-border bg-surface-variant"
                >
                  {asset.type === "image" ? (
                    <img src={resolveMediaUrl(asset.url)} alt={asset.label ?? "Sample"} className="aspect-[4/5] w-full object-cover" />
                  ) : (
                    <video src={resolveMediaUrl(asset.url)} className="aspect-[4/5] w-full bg-black object-cover" muted preload="metadata" />
                  )}
                  {asset.label && <p className="truncate px-2 py-1.5 text-[11px] text-muted group-hover:text-foreground">{asset.label}</p>}
                </a>
              ))}
            </div>
          </div>
        )}

        {campaign.sourceAssets && campaign.sourceAssets.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Source files for clippers</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {campaign.sourceAssets.map((asset, i) => (
                <LinkCard
                  key={`${asset.url}-${i}`}
                  label={asset.label || (asset.type === "upload" ? "Uploaded file" : asset.type === "youtube" ? "YouTube" : "Google Drive")}
                  url={asset.type === "upload" ? resolveMediaUrl(asset.url) : asset.url}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 lg:self-start">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Key details</p>
        <dl className="mt-3 divide-y divide-border/60">
          {facts.map((f) => (
            <div key={f.label} className="flex items-start justify-between gap-4 py-2.5 text-sm">
              <dt className="shrink-0 text-muted">{f.label}</dt>
              <dd className="text-right font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/* ── Campaign detail page ── */

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const role = usePortalRole();
  const isAdmin = role === "admin";
  const tabs = isAdmin ? [...TABS, { id: "payouts" as const, label: "Payouts" }] : TABS;
  const { getToken } = useAuth();
  const { toast } = useToast();
  // The open tab lives in the URL, so a refresh or a shared link lands on it.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: Tab = tabs.some((t) => t.id === tabParam) ? (tabParam as Tab) : "overview";
  function setTab(next: Tab) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === "overview") params.delete("tab");
        else params.set("tab", next);
        return params;
      },
      { replace: true },
    );
  }
  const [selectedSubmission, setSelectedSubmission] = useState<{ id: string; section: ReviewSection } | null>(null);
  const [selectedClipperId, setSelectedClipperId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<"live" | "paused" | null>(null);
  const [showClipperIntakeDialog, setShowClipperIntakeDialog] = useState(false);

  const { data: campaign, isPending } = useCampaign(id);
  const { data: deliverables = [] } = useQuery({
    queryKey: ["campaign-deliverables", id],
    queryFn: () => portalApi.submissions.listByCampaign(getToken()!, id!),
    enabled: Boolean(getToken() && id),
  });
  const updateStatus = useUpdateCampaignStatus();
  const updateAutoReview = useUpdateCampaignAutoReview();
  const queryClient = useQueryClient();

  const clipperIntakeMutation = useMutation({
    mutationFn: (extraClipperAllowance: number) =>
      adminApi.setClipperIntake(getToken()!, id!, extraClipperAllowance),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["campaign", id] });
      setShowClipperIntakeDialog(false);
      toast(
        result.newClipperIntakeStatus === "closed_at_threshold"
          ? "Intake closed — new clippers can't join right now"
          : `Intake opened for ${result.extraClipperAllowance} more clipper${result.extraClipperAllowance === 1 ? "" : "s"}`,
      );
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Could not update intake", "error"),
  });

  const fileSlug = (campaign?.title ?? "campaign").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "campaign";
  const generateReportMutation = useMutation({
    mutationFn: () => adminApi.generateCampaignReport(getToken()!, id!),
    onSuccess: (blob) => {
      downloadBlob(blob, `${fileSlug}-report.pdf`);
      toast("Report downloaded");
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Could not generate the report", "error"),
  });
  const downloadLedgerMutation = useMutation({
    mutationFn: () => adminApi.downloadCampaignLedger(getToken()!, id!),
    onSuccess: (blob) => {
      downloadBlob(blob, `${fileSlug}-ledger.csv`);
      toast("Ledger downloaded");
    },
    onError: (err) => toast(err instanceof ApiError ? err.message : "Could not download the ledger", "error"),
  });

  if (isPending || !campaign) return <DetailPageSkeleton />;

  // A view-only team member can look at everything but change nothing.
  const readOnly = campaign.viewerAccess === "view";
  const editPath = id && campaign.status !== "closed" && !readOnly ? getWizardEditPath(id, isAdmin) : null;
  const editLabel =
    campaign.status === "draft"
      ? "Continue editing"
      : isLockedForReview(campaign.status, isAdmin)
        ? "View submission"
        : campaign.status === "pending_review"
          ? "Review / edit"
          : "Edit campaign";
  // Staff arrive via a specific brand's page, not a generic campaigns list — fall back to browser history for them.
  const backTo = isAdmin ? "/admin/campaigns" : role === "brand" ? "/campaigns" : undefined;

  async function confirmStatusChange() {
    if (!id || !pendingStatus) return;
    try {
      await updateStatus.mutateAsync({ id, status: pendingStatus });
      toast(pendingStatus === "paused" ? "Campaign paused" : "Campaign resumed");
      setPendingStatus(null);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not update campaign", "error");
    }
  }

  async function toggleAutoReview() {
    if (!id || !campaign) return;
    const next = !campaign.autoReviewEnabled;
    try {
      await updateAutoReview.mutateAsync({ id, autoReviewEnabled: next });
      toast(next ? "Auto-verification turned on" : "Auto-verification turned off");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not update auto-verification", "error");
    }
  }

  const clippers = buildClipperProfiles(deliverables);
  const selectedClipper = clippers.find((c) => c.participationId === selectedClipperId) ?? null;
  const stageCounts = countBy(deliverables, (d) => deliverableStage(d));
  const count = (...stages: Stage[]) => stages.reduce((sum, s) => sum + (stageCounts[s] ?? 0), 0);
  const workToReview = count("work_review");
  const proofToReview = count("proof_review");
  const proofApproved = count("awaiting_payment", "paid");
  const tabBadgeCounts: Partial<Record<Tab, number>> = {
    submissions: workToReview,
    proof: proofToReview,
  };
  const totalClippers = clippers.length;

  const creatorPerformance = buildCreatorPerformance(deliverables);
  const totalViews = deliverables.reduce((sum, d) => sum + d.viewCount, 0);
  const totalLikes = deliverables.reduce((sum, d) => sum + d.likeCount, 0);
  const totalComments = deliverables.reduce((sum, d) => sum + d.commentCount, 0);
  const totalShares = deliverables.reduce((sum, d) => sum + d.shareCount, 0);
  const approvedEarnings = deliverables.reduce((sum, d) => sum + approvedEarningsPaise(d), 0);

  const campaignStatusStyle = CAMPAIGN_STATUS_STYLE[campaign.status] ?? CAMPAIGN_STATUS_STYLE.draft;

  return (
    <div className="space-y-5">
      <BackButton to={backTo} label="Back to campaigns" />

      <CampaignReviewBanner campaign={campaign} isAdmin={isAdmin} />

      {/* ── Hero ── */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex flex-col sm:flex-row sm:items-stretch">
          {/* Cover image — 16:9, the standard cover ratio used across the app */}
          <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-surface-variant sm:w-56">
            {campaign.coverImageUrl ? (
              <img
                src={resolveMediaUrl(campaign.coverImageUrl)}
                alt={campaign.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/20 to-primary/5">
                <svg className="h-12 w-12 text-primary/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.847v6.306a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </div>
            )}
          </div>

          {/* Info panel */}
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${campaignStatusStyle}`}>
                    {campaignStatusLabel(campaign.status)}
                  </span>
                  {campaign.platforms?.map((p) => (
                    <span key={p} className="rounded-full bg-surface-variant px-2 py-0.5 text-[10px] text-muted">
                      {formatPlatformLabel(p)}
                    </span>
                  ))}
                </div>
                <h1 className="mt-2 break-words text-xl font-black leading-tight">{campaign.title}</h1>
                <p className="mt-0.5 text-sm font-semibold text-primary">{campaign.ratePer1kDisplay}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
                {editPath && (
                  <Link to={editPath} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "shrink-0")}>
                    {editLabel}
                  </Link>
                )}
                {readOnly && (
                  <span className="rounded-full bg-surface-variant px-3 py-1 text-xs font-semibold text-muted">View only</span>
                )}
                {campaign.status === "live" && !readOnly && (
                  <Button size="sm" variant="outline" onClick={() => setPendingStatus("paused")}>
                    Pause
                  </Button>
                )}
                {campaign.status === "paused" && !readOnly && (
                  <Button size="sm" onClick={() => setPendingStatus("live")}>
                    Resume
                  </Button>
                )}
                {/* What a brand gets instead of a share link: the report (PDF)
                    and the per-reel ledger (CSV). Admin-only on the API. */}
                {isAdmin && campaign.status !== "draft" && campaign.status !== "pending_review" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={generateReportMutation.isPending}
                      onClick={() => generateReportMutation.mutate()}
                      title="Generate a detailed performance report (PDF) for this campaign"
                    >
                      {generateReportMutation.isPending ? "Generating…" : "Generate report"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadLedgerMutation.isPending}
                      onClick={() => downloadLedgerMutation.mutate()}
                      title="Download a spreadsheet (CSV) with views, reach and engagement for every clip in this campaign"
                    >
                      {downloadLedgerMutation.isPending ? "Downloading…" : "Download ledger"}
                    </Button>
                  </>
                )}
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updateAutoReview.isPending}
                    onClick={() => void toggleAutoReview()}
                    title="Whether the automated review pipeline checks this campaign's submissions"
                  >
                    <span
                      className={cn(
                        "mr-1.5 inline-block h-2 w-2 rounded-full",
                        campaign.autoReviewEnabled ? "bg-green-400" : "bg-muted",
                      )}
                    />
                    Auto-verification {campaign.autoReviewEnabled ? "on" : "off"}
                  </Button>
                )}
              </div>
            </div>

            {/* Quick stats row */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {[
                { label: "Clippers", value: totalClippers, onClick: () => setTab("clippers") },
                { label: "Work to review", value: workToReview, onClick: () => setTab("submissions"), alert: workToReview > 0 },
                { label: "Proof to review", value: proofToReview, onClick: () => setTab("proof"), alert: proofToReview > 0 },
                { label: "Proof approved", value: proofApproved, onClick: () => setTab("proof") },
                { label: "Pool used", value: `${campaign.poolPercent}%` },
              ].map(({ label, value, onClick, alert }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  disabled={!onClick}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-center transition-colors enabled:hover:border-primary/50 sm:px-4",
                    alert ? "border-warning/50 bg-warning/10" : "border-border bg-surface-variant",
                  )}
                >
                  <p className={cn("text-base font-black", alert && "text-warning")}>{value}</p>
                  <p className="text-[10px] text-muted">{label}</p>
                </button>
              ))}
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setShowClipperIntakeDialog(true)}
                  className="rounded-xl border border-border bg-surface-variant px-3 py-2 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 sm:px-4"
                >
                  <StatusPill status={campaign.newClipperIntakeStatus} />
                  <p className="mt-1 text-[10px] text-muted">Slots · manage</p>
                </button>
              ) : (
                <div className="rounded-xl border border-border bg-surface-variant px-3 py-2 text-center sm:px-4">
                  <StatusPill status={campaign.newClipperIntakeStatus} />
                  <p className="mt-1 text-[10px] text-muted">Slots</p>
                </div>
              )}
              <div className="w-full sm:ml-auto sm:w-auto sm:text-right">
                <p className="text-xs text-muted">Budget</p>
                <p className="text-sm font-bold">
                  {formatInr(campaign.budgetUsedPaise)} <span className="font-normal text-muted">/ {formatInr(campaign.budgetPaise)}</span>
                </p>
                <ProgressBar className="mt-1 w-full sm:ml-auto sm:w-32" percent={campaign.poolPercent} variant={campaign.poolPercent > 80 ? "warning" : "default"} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex overflow-x-auto border-b border-border" role="tablist">
        {tabs.map((t) => {
          const badgeCount = tabBadgeCounts[t.id] ?? 0;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {badgeCount > 0 && (
                <span
                  className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white"
                  title={`${badgeCount} waiting for review`}
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
              {tab === t.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <CampaignOverview campaign={campaign} />}

      {tab === "clippers" && (
        <ClipperProfileGrid items={clippers} onSelect={(c) => setSelectedClipperId(c.participationId)} />
      )}

      {tab === "board" && (
        <StatusBoard
          deliverables={deliverables}
          onOpen={(d) => setSelectedSubmission({ id: d.id, section: reviewSectionFor(d) })}
        />
      )}

      {tab === "submissions" && (
        <SubmissionGrid
          items={deliverables}
          section="submissions"
          onSelect={(deliverableId) => setSelectedSubmission({ id: deliverableId, section: "submissions" })}
          emptyMessage="No work submitted yet."
        />
      )}

      {tab === "proof" && (
        <SubmissionGrid
          items={deliverables}
          section="proof"
          onSelect={(deliverableId) => setSelectedSubmission({ id: deliverableId, section: "proof" })}
          emptyMessage="No proof of work submitted yet. It shows up here once a clipper posts approved work live."
        />
      )}

      {tab === "analytics" && (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Campaign performance</p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {[
                { label: "Total views", value: formatCount(totalViews) },
                { label: "Total likes", value: formatCount(totalLikes) },
                { label: "Total comments", value: formatCount(totalComments) },
                { label: "Total shares", value: formatCount(totalShares) },
                { label: "Earned (approved proof)", value: formatInr(approvedEarnings) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl border border-border bg-surface p-5 text-center">
                  <p className="text-2xl font-black">{value}</p>
                  <p className="mt-1 text-xs text-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Top performers</p>
            <Leaderboard items={creatorPerformance} />
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Pipeline</p>
            <p className="mb-4 text-xs text-muted">Each format a clipper joined with, by where it stands now.</p>
            {STAGE_ORDER.filter((s) => s !== "proof_approved").map((stage) => (
              <div key={stage} className="flex items-center justify-between border-b border-border/40 py-2.5 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", TAG_META[stage].dot)} />
                  <span className="text-sm">{TAG_META[stage].label}</span>
                </div>
                <span className="text-sm font-semibold">{stageCounts[stage] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "payouts" && isAdmin && id && <PayoutsPanel campaignId={id} />}

      {selectedSubmission && (
        <SubmissionDetailModal
          key={`${selectedSubmission.id}-${selectedSubmission.section}`}
          deliverableId={selectedSubmission.id}
          section={selectedSubmission.section}
          readOnly={readOnly}
          onClose={() => setSelectedSubmission(null)}
        />
      )}

      {selectedClipper && !selectedSubmission && (
        <ClipperProfileModal
          clipper={selectedClipper}
          onClose={() => setSelectedClipperId(null)}
          onOpen={(deliverableId, section) => setSelectedSubmission({ id: deliverableId, section })}
        />
      )}

      <ConfirmDialog
        open={pendingStatus !== null}
        title={pendingStatus === "paused" ? "Pause campaign?" : "Resume campaign?"}
        description={
          pendingStatus === "paused"
            ? "Creators will no longer see this campaign until you resume it."
            : "Make this campaign live for creators again."
        }
        confirmLabel={pendingStatus === "paused" ? "Pause" : "Resume"}
        loading={updateStatus.isPending}
        onConfirm={() => void confirmStatusChange()}
        onCancel={() => setPendingStatus(null)}
      />

      <ClipperIntakeDialog
        open={showClipperIntakeDialog}
        loading={clipperIntakeMutation.isPending}
        onSubmit={(extraClipperAllowance) => clipperIntakeMutation.mutate(extraClipperAllowance)}
        onCancel={() => setShowClipperIntakeDialog(false)}
      />
    </div>
  );
}
