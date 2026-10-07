import { useEffect, useState } from "react";

import { CreatorProfileModal } from "@/features/creators/components/CreatorProfileModal";
import {
  actorLabel,
  actorSentence,
  BOARD_COLUMNS,
  RANK_STYLE,
  formatCount,
  formatDate,
  type ClipperProfile,
  type CreatorPerformance,
  type CreatorProfileSnippet,
  type DeliverableForBoard,
  type ReviewActor,
} from "@/features/campaigns/lib/campaign-board-data";
import {
  countBy,
  deliverableStage,
  isProofStatus,
  NEEDS_REVIEW,
  proofOutcome,
  STAGE_ORDER,
  TAG_META,
  workOutcome,
  type Stage,
  type Tag,
} from "@/features/campaigns/lib/clipper-stage";
import { formatPlatformLabel } from "@/features/campaigns/lib/platform-labels";
import { formatInr } from "@/lib/format";
import { resolveMediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";

const PROFILE_PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "Twitter",
  tiktok: "TikTok",
};

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-border bg-surface py-14">
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

/* ── Shared bits ── */

export function StageTag({ tag, prefix, className }: { tag: Tag; prefix?: string; className?: string }) {
  const meta = TAG_META[tag];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-left text-[11px] font-semibold leading-snug",
        meta.tone,
        className,
      )}
      title={meta.hint}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
      <span>
        {prefix ? `${prefix} · ` : ""}
        {meta.label}
      </span>
    </span>
  );
}

export function CreatorAvatar({ name, url, size = "md" }: { name: string; url?: string | null; size?: "sm" | "md" | "lg" }) {
  const [broken, setBroken] = useState(false);
  const box = size === "sm" ? "h-9 w-9 text-sm" : size === "lg" ? "h-14 w-14 text-xl" : "h-11 w-11 text-base";
  if (url && !broken) {
    return (
      <img
        src={resolveMediaUrl(url)}
        alt=""
        onError={() => setBroken(true)}
        className={cn("shrink-0 rounded-full border border-border object-cover", box)}
      />
    );
  }
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-black text-primary", box)}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function handleLine(profile: CreatorProfileSnippet | null | undefined, platforms: string[]) {
  return profile
    ? `@${profile.handle} · ${PROFILE_PLATFORM_LABELS[profile.platform] ?? profile.platform}`
    : platforms.map(formatPlatformLabel).join(", ");
}

export type ChipOption<T extends string> = { id: T; label: string; count: number };

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            value === o.id
              ? "border-primary bg-primary text-white"
              : "border-border bg-surface text-muted hover:border-primary/40 hover:text-foreground",
          )}
        >
          {o.label}
          <span className={cn("rounded-full px-1.5 text-[10px]", value === o.id ? "bg-white/20" : "bg-surface-variant")}>
            {o.count}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Which review a deliverable opens in: its proof once a live link exists. */
export function reviewSectionFor(d: { status: string }): ReviewSection {
  return isProofStatus(d.status) ? "proof" : "submissions";
}

export type ReviewSection = "submissions" | "proof";

/* ── Status Board (read-only pipeline stages) ── */

function BoardStageCard({
  d,
  onViewProfile,
  onOpen,
}: {
  d: DeliverableForBoard;
  onViewProfile: (creatorId: string) => void;
  onOpen?: (d: DeliverableForBoard) => void;
}) {
  const stage = deliverableStage(d);
  const canOpen = Boolean(onOpen) && stage !== "applied";
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2.5">
        <CreatorAvatar name={d.creatorName} url={d.creatorProfile?.avatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          {d.creatorId ? (
            <button
              type="button"
              onClick={() => onViewProfile(d.creatorId!)}
              className="block max-w-full truncate text-sm font-semibold hover:text-primary hover:underline"
            >
              {d.creatorName}
            </button>
          ) : (
            <p className="truncate text-sm font-semibold">{d.creatorName}</p>
          )}
          <p className="truncate text-[11px] text-muted">
            {d.creatorProfile ? `@${d.creatorProfile.handle} · ` : ""}
            {formatPlatformLabel(d.platform)}
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <StageTag tag={stage} />
        {d.priorRejectionCount > 0 && (
          <span className="shrink-0 text-[10px] font-semibold text-destructive">
            {d.priorRejectionCount} rejection{d.priorRejectionCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
      {stageActor(d, stage) && (
        <p className="mt-1.5 truncate text-[11px] text-muted" title={actorSentence(stageActor(d, stage)!)}>
          by {actorLabel(stageActor(d, stage)!)}
        </p>
      )}
      {canOpen && (
        <button
          type="button"
          onClick={() => onOpen!(d)}
          className="mt-2.5 w-full rounded-lg border border-border py-1.5 text-xs font-semibold text-muted hover:border-primary/40 hover:text-primary"
        >
          {NEEDS_REVIEW.includes(stage) ? "Review" : "Open"}
        </button>
      )}
    </div>
  );
}

/** Who put a clip into the stage it's in now (nobody, while it waits on review). */
export function stageActor(d: DeliverableForBoard, stage: Stage): ReviewActor | null {
  switch (stage) {
    case "work_rejected":
    case "awaiting_proof":
      return d.workReviewedBy ?? null;
    case "proof_rejected":
    case "awaiting_payment":
    case "proof_approved":
      return d.proofReviewedBy ?? null;
    case "paid":
      return d.paidBy ?? d.proofReviewedBy ?? null;
    default:
      return null;
  }
}

function EmptyColumn() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-variant text-xs font-bold text-muted">0</span>
      <p className="text-xs text-muted">No clippers in this stage</p>
    </div>
  );
}

export function StatusBoard({
  deliverables,
  onOpen,
}: {
  deliverables: DeliverableForBoard[];
  onOpen?: (d: DeliverableForBoard) => void;
}) {
  const [viewCreatorId, setViewCreatorId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-4" style={{ height: "calc(100vh - 260px)", minHeight: 420 }}>
      {viewCreatorId && <CreatorProfileModal creatorId={viewCreatorId} onClose={() => setViewCreatorId(null)} />}
      <div className="flex h-full gap-4">
        {BOARD_COLUMNS.map((col) => {
          const items = deliverables.filter((d) => col.stages.includes(deliverableStage(d)));
          return (
            <div key={col.id} className="flex w-72 shrink-0 flex-col rounded-xl bg-surface-variant/30">
              <div className="flex items-center gap-2 px-3 py-3">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="ml-auto rounded-full bg-surface-variant px-2 py-0.5 text-[10px] font-bold text-muted">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
                {items.length === 0
                  ? <EmptyColumn />
                  : items.map((d) => <BoardStageCard key={d.id} d={d} onViewProfile={setViewCreatorId} onOpen={onOpen} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Working Clippers ── */

export function ClipperProfileCard({ clipper, onOpen }: { clipper: ClipperProfile; onOpen: () => void }) {
  const multiFormat = clipper.deliverables.length > 1;
  const needsReview = clipper.stages.some((s) => NEEDS_REVIEW.includes(s));
  const hintStage = clipper.stages.find((s) => NEEDS_REVIEW.includes(s)) ?? clipper.stages[0];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full flex-col rounded-2xl border bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg",
        needsReview ? "border-warning/50 hover:border-warning" : "border-border hover:border-primary/30",
      )}
    >
      <div className="flex w-full items-center gap-3">
        <CreatorAvatar name={clipper.creatorName} url={clipper.creatorProfile?.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{clipper.creatorName}</p>
          <p className="truncate text-[11px] text-muted">{handleLine(clipper.creatorProfile, clipper.platforms)}</p>
        </div>
        {needsReview && (
          <span className="relative flex h-2.5 w-2.5 shrink-0" title="Needs your review">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-warning" />
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {clipper.deliverables.map((d, i) => (
          <StageTag
            key={d.id}
            tag={clipper.stages[i]}
            prefix={multiFormat ? formatPlatformLabel(d.platform) : undefined}
          />
        ))}
      </div>
      {hintStage && <p className="mt-1.5 text-[11px] text-muted">{TAG_META[hintStage].hint}</p>}

      <div className="mt-auto grid w-full grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
        <div>
          <p className="text-sm font-bold">{formatCount(clipper.totalViews)}</p>
          <p className="text-[10px] text-muted">Views</p>
        </div>
        <div>
          <p className="text-sm font-bold">{formatInr(clipper.totalEarningsPaise)}</p>
          <p className="text-[10px] text-muted">Earned</p>
        </div>
        <div>
          <p className={cn("text-sm font-bold", clipper.rejectionCount > 0 && "text-destructive")}>{clipper.rejectionCount}</p>
          <p className="text-[10px] text-muted">Rejections</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted">Joined {formatDate(clipper.joinedAt)}</p>
    </button>
  );
}

type ClipperFilter = "all" | "needs_review" | Stage;

export function ClipperProfileGrid({ items, onSelect }: { items: ClipperProfile[]; onSelect: (c: ClipperProfile) => void }) {
  const [filter, setFilter] = useState<ClipperFilter>("all");
  const [query, setQuery] = useState("");

  if (items.length === 0) return <EmptyState message="No clippers have joined yet." />;

  const has = (c: ClipperProfile, f: ClipperFilter) =>
    f === "all" ? true : f === "needs_review" ? c.stages.some((s) => NEEDS_REVIEW.includes(s)) : c.stages.includes(f);
  const allOptions: ChipOption<ClipperFilter>[] = [
    { id: "all", label: "All", count: items.length },
    { id: "needs_review", label: "Needs review", count: items.filter((c) => has(c, "needs_review")).length },
    ...STAGE_ORDER.map((s) => ({ id: s, label: TAG_META[s].label, count: items.filter((c) => has(c, s)).length })),
  ];
  const options = allOptions.filter((o) => o.id === "all" || o.count > 0);

  const q = query.trim().toLowerCase();
  const visible = items.filter(
    (c) =>
      has(c, filter) &&
      (!q || c.creatorName.toLowerCase().includes(q) || (c.creatorProfile?.handle.toLowerCase().includes(q) ?? false)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <FilterChips options={options} value={options.some((o) => o.id === filter) ? filter : "all"} onChange={setFilter} />
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or @handle"
          aria-label="Search clippers"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary lg:w-64"
        />
      </div>
      {visible.length === 0 ? (
        <EmptyState message="No clippers match this filter." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((c) => (
            <ClipperProfileCard key={c.participationId} clipper={c} onOpen={() => onSelect(c)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineRow({ label, at, by }: { label: string; at: string | null | undefined; by?: ReviewActor | null }) {
  if (!at) return null;
  return (
    <div className="flex items-start justify-between gap-3 text-[11px]">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium">
        {formatDate(at)}
        {by && <span className="block font-normal text-muted">by {actorLabel(by)}</span>}
      </span>
    </div>
  );
}

export function ClipperProfileModal({
  clipper,
  onClose,
  onOpen,
}: {
  clipper: ClipperProfile;
  onClose: () => void;
  /** Opens a format's work or proof review. */
  onOpen?: (deliverableId: string, section: ReviewSection) => void;
}) {
  const [showFullProfile, setShowFullProfile] = useState(false);
  useEscape(onClose, !showFullProfile);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      {showFullProfile && clipper.creatorId && (
        <CreatorProfileModal creatorId={clipper.creatorId} onClose={() => setShowFullProfile(false)} />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${clipper.creatorName} — clipper`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-bold">Clipper</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-muted hover:bg-surface-variant hover:text-foreground">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-6">
          <div className="flex items-center gap-3">
            <CreatorAvatar name={clipper.creatorName} url={clipper.creatorProfile?.avatarUrl} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{clipper.creatorName}</p>
              <p className="truncate text-xs text-muted">{handleLine(clipper.creatorProfile, clipper.platforms)}</p>
              <p className="text-xs text-muted">Joined {formatDate(clipper.joinedAt)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Views", value: formatCount(clipper.totalViews) },
              { label: "Earned", value: formatInr(clipper.totalEarningsPaise) },
              { label: "Rejections", value: String(clipper.rejectionCount) },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-surface-variant/40 px-2 py-2">
                <p className="text-sm font-bold">{s.value}</p>
                <p className="text-[10px] text-muted">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Formats</p>
            {clipper.deliverables.map((d, i) => {
              const stage = clipper.stages[i];
              const hasWork = Boolean(d.draftSubmittedAt) || stage !== "applied";
              const hasProof = isProofStatus(d.status);
              const rejectedHere = stage === "work_rejected" || stage === "proof_rejected";
              return (
                <div key={d.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{formatPlatformLabel(d.platform)}</span>
                    <StageTag tag={stage} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted">{TAG_META[stage].hint}</p>
                  {rejectedHere && d.rejectionReason && (
                    <p className="mt-2 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                      “{d.rejectionReason}”
                    </p>
                  )}
                  <div className="mt-2 space-y-1">
                    <TimelineRow label="Work submitted" at={d.draftSubmittedAt} />
                    <TimelineRow
                      label={d.workReviewedBy?.step === "work_rejected" ? "Work rejected" : d.workReviewedBy ? "Work approved" : "Work reviewed"}
                      at={d.draftReviewedAt}
                      by={d.workReviewedBy}
                    />
                    <TimelineRow label="Live post submitted" at={d.liveSubmittedAt} />
                    <TimelineRow
                      label={d.proofReviewedBy?.step === "proof_rejected" ? "Proof rejected" : d.proofReviewedBy ? "Proof approved" : "Proof reviewed"}
                      at={d.proofReviewedAt}
                      by={d.proofReviewedBy}
                    />
                    <TimelineRow label="Paid" at={d.paidAt} by={d.paidBy} />
                  </div>
                  {onOpen && (hasWork || hasProof) && (
                    <div className="mt-3 flex gap-2">
                      {hasWork && (
                        <button
                          type="button"
                          onClick={() => onOpen(d.id, "submissions")}
                          className="flex-1 rounded-lg border border-border py-1.5 text-xs font-semibold hover:border-primary/40 hover:text-primary"
                        >
                          {stage === "work_review" ? "Review work" : "View work"}
                        </button>
                      )}
                      {hasProof && (
                        <button
                          type="button"
                          onClick={() => onOpen(d.id, "proof")}
                          className="flex-1 rounded-lg border border-border py-1.5 text-xs font-semibold hover:border-primary/40 hover:text-primary"
                        >
                          {stage === "proof_review" ? "Review proof" : "View proof"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {clipper.creatorId && (
            <button
              type="button"
              onClick={() => setShowFullProfile(true)}
              className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold hover:border-primary/30 hover:text-primary"
            >
              View full profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Escape closes the window — switched off while a dialog on top of it is open. */
export function useEscape(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, enabled]);
}

/* ── Analytics leaderboard ── */

export function Leaderboard({ items }: { items: CreatorPerformance[] }) {
  const [viewCreatorId, setViewCreatorId] = useState<string | null>(null);

  if (items.length === 0) return <EmptyState message="No performance data yet." />;
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      {viewCreatorId && <CreatorProfileModal creatorId={viewCreatorId} onClose={() => setViewCreatorId(null)} />}
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[40px_1fr_80px_80px_90px_80px_100px] gap-2 border-b border-border bg-surface-variant/40 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted">
          <span>#</span>
          <span>Creator</span>
          <span className="text-right">Views</span>
          <span className="text-right">Likes</span>
          <span className="text-right">Comments</span>
          <span className="text-right">Shares</span>
          <span className="text-right">Earnings</span>
        </div>
        {items.map((c, i) => {
          const rank = i + 1;
          return (
            <div
              key={c.participationId}
              className="grid grid-cols-[40px_1fr_80px_80px_90px_80px_100px] items-center gap-2 border-b border-border/40 px-4 py-3 last:border-0"
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold ${RANK_STYLE[rank] ?? "bg-surface-variant text-muted border-border"}`}>
                {rank}
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-black text-primary">
                  {c.creatorName.charAt(0).toUpperCase()}
                </div>
                {c.creatorId ? (
                  <button
                    type="button"
                    onClick={() => setViewCreatorId(c.creatorId!)}
                    className="truncate text-sm font-semibold hover:text-primary hover:underline"
                  >
                    {c.creatorName}
                  </button>
                ) : (
                  <p className="truncate text-sm font-semibold">{c.creatorName}</p>
                )}
              </div>
              <span className="text-right text-sm font-medium">{formatCount(c.totalViews)}</span>
              <span className="text-right text-sm font-medium">{formatCount(c.totalLikes)}</span>
              <span className="text-right text-sm font-medium">{formatCount(c.totalComments)}</span>
              <span className="text-right text-sm font-medium">{formatCount(c.totalShares)}</span>
              <span className="text-right text-sm font-semibold text-primary">{formatInr(c.totalEarningsPaise)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Work Submissions / Proof of Work ──
   Each tab shows only its own step: the Work tab shows the work and how its
   review went (a clipper who moved on to proof just reads "Work approved"
   there), the Proof tab shows the live post and its review/payment. */

function sectionTag(d: DeliverableForBoard, section: ReviewSection): Tag | null {
  return section === "submissions" ? workOutcome(d) : proofOutcome(d);
}

export function SubmissionCard({
  d,
  section,
  onOpen,
}: {
  d: DeliverableForBoard;
  section: ReviewSection;
  onOpen: () => void;
}) {
  const tag = sectionTag(d, section);
  const needsReview = tag === "work_review" || tag === "proof_review";
  const rejected = tag === "work_rejected" || tag === "proof_rejected";
  const submittedAt = section === "submissions" ? d.draftSubmittedAt : (d.liveSubmittedAt ?? null);
  const reviewedAt = section === "submissions" ? d.draftReviewedAt : d.proofReviewedAt;
  const reviewer = section === "submissions" ? d.workReviewedBy : d.proofReviewedBy;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex w-full flex-col overflow-hidden rounded-2xl border bg-surface text-left transition-all hover:-translate-y-0.5 hover:shadow-lg",
        needsReview ? "border-warning/50 hover:border-warning" : "border-border hover:border-primary/30",
      )}
    >
      <div className="flex w-full items-center gap-3 border-b border-border/50 p-4">
        <CreatorAvatar name={d.creatorName} url={d.creatorProfile?.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold group-hover:text-primary">{d.creatorName}</p>
          <p className="truncate text-[11px] text-muted">
            {d.creatorProfile ? `@${d.creatorProfile.handle} · ` : ""}
            {formatPlatformLabel(d.platform)}
          </p>
        </div>
      </div>

      <div className="w-full flex-1 space-y-2.5 p-4">
        {tag && <StageTag tag={tag} />}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">{section === "submissions" ? "Work submitted" : "Live post submitted"}</span>
          <span className="font-medium">{submittedAt ? formatDate(submittedAt) : "—"}</span>
        </div>
        {reviewedAt && !needsReview && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Reviewed</span>
            <span className="font-medium">{formatDate(reviewedAt)}</span>
          </div>
        )}
        {reviewer && !needsReview && (
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="shrink-0 text-muted">{rejected ? "Rejected by" : "Approved by"}</span>
            <span className="truncate font-semibold" title={actorSentence(reviewer)}>
              {actorLabel(reviewer)}
            </span>
          </div>
        )}
        {section === "proof" && d.paidAt && d.paidBy && (
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="shrink-0 text-muted">Paid by</span>
            <span className="truncate font-semibold">{actorLabel(d.paidBy)}</span>
          </div>
        )}
        {section === "proof" && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Views · earning</span>
            <span className="font-medium">
              {formatCount(d.viewCount)} · {formatInr(d.estimatedPaise)}
            </span>
          </div>
        )}
        {section === "submissions" && d.priorRejectionCount > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Earlier rejections</span>
            <span className="font-semibold text-destructive">{d.priorRejectionCount}</span>
          </div>
        )}
        {rejected && d.rejectionReason && (
          <p className="line-clamp-2 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">“{d.rejectionReason}”</p>
        )}
      </div>

      <div
        className={cn(
          "flex w-full items-center justify-between border-t border-border/50 px-4 py-2.5 text-xs font-semibold",
          needsReview ? "bg-warning/10 text-warning" : "text-muted",
        )}
      >
        <span>{needsReview ? (section === "submissions" ? "Review work" : "Review proof") : "View details"}</span>
        <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

type SectionFilter = "needs_review" | "rejected" | "approved" | "awaiting_payment" | "paid" | "all";

function sectionFilterOf(tag: Tag | null): SectionFilter | null {
  switch (tag) {
    case "work_review":
    case "proof_review":
      return "needs_review";
    case "work_rejected":
    case "proof_rejected":
      return "rejected";
    case "work_approved":
    case "proof_approved":
      return "approved";
    case "awaiting_payment":
      return "awaiting_payment";
    case "paid":
      return "paid";
    default:
      return null;
  }
}

const SECTION_FILTER_LABEL: Record<SectionFilter, string> = {
  needs_review: "Needs review",
  rejected: "Rejected",
  approved: "Approved",
  awaiting_payment: "Waiting for payment",
  paid: "Paid",
  all: "All",
};

/** Items that belong in a tab: anything with work submitted for the Work
 * tab, anything with a live link for the Proof tab. */
export function itemsForSection<T extends DeliverableForBoard>(items: T[], section: ReviewSection): T[] {
  return items.filter((d) => sectionTag(d, section) !== null);
}

export function SubmissionGrid({
  items,
  section,
  onSelect,
  emptyMessage,
}: {
  items: DeliverableForBoard[];
  section: ReviewSection;
  onSelect: (id: string) => void;
  emptyMessage: string;
}) {
  const inSection = itemsForSection(items, section);
  const counts = countBy(inSection, (d) => sectionFilterOf(sectionTag(d, section)));
  const [chosen, setChosen] = useState<SectionFilter | null>(null);

  if (inSection.length === 0) return <EmptyState message={emptyMessage} />;

  const order: SectionFilter[] =
    section === "submissions"
      ? ["needs_review", "rejected", "approved", "all"]
      : ["needs_review", "rejected", "awaiting_payment", "paid", "approved", "all"];
  const options: ChipOption<SectionFilter>[] = order
    .map((id) => ({ id, label: SECTION_FILTER_LABEL[id], count: id === "all" ? inSection.length : (counts[id] ?? 0) }))
    .filter((o) => o.id === "all" || o.id === "needs_review" || o.count > 0);
  // Open on whatever needs attention; fall back to everything.
  const filter = chosen ?? ((counts.needs_review ?? 0) > 0 ? "needs_review" : "all");

  const at = (d: DeliverableForBoard) => (section === "submissions" ? d.draftSubmittedAt : d.liveSubmittedAt) ?? "";
  const visible = inSection
    .filter((d) => filter === "all" || sectionFilterOf(sectionTag(d, section)) === filter)
    .sort((a, b) => {
      const aNeeds = sectionFilterOf(sectionTag(a, section)) === "needs_review";
      const bNeeds = sectionFilterOf(sectionTag(b, section)) === "needs_review";
      // Waiting longest first among items to review; newest first otherwise.
      if (aNeeds !== bNeeds) return aNeeds ? -1 : 1;
      return aNeeds ? at(a).localeCompare(at(b)) : at(b).localeCompare(at(a));
    });

  return (
    <div className="space-y-4">
      <FilterChips options={options} value={filter} onChange={setChosen} />
      {visible.length === 0 ? (
        <EmptyState message={filter === "needs_review" ? "Nothing waiting for review." : "Nothing here."} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((d) => (
            <SubmissionCard key={d.id} d={d} section={section} onOpen={() => onSelect(d.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Media preview (draft / live post link rendering) ── */

export function LinkCard({ label, url }: { label: string; url: string }) {
  let domain = url;
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // not a fully-qualified URL — fall back to showing it as-is
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-border bg-surface-variant/50 p-4 transition-colors hover:border-primary/30"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-muted">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
        <p className="truncate text-sm font-semibold text-primary">{domain}</p>
      </div>
    </a>
  );
}

function detectFileKind(pathname: string): "video" | "image" | null {
  const ext = pathname.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  if (["mp4", "mov", "webm", "m4v"].includes(ext)) return "video";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
  return null;
}

const scriptLoadPromises = new Map<string, Promise<void>>();

function loadScriptOnce(src: string): Promise<void> {
  const existing = scriptLoadPromises.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
  scriptLoadPromises.set(src, promise);
  return promise;
}

function PreviewLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      {children}
    </div>
  );
}

function IframePreview({ src }: { src: string }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
      <iframe src={src} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
    </div>
  );
}

function InstagramEmbed({ url }: { url: string }) {
  useEffect(() => {
    loadScriptOnce("https://www.instagram.com/embed.js").then(() => {
      (window as unknown as { instgrm?: { Embeds: { process: () => void } } }).instgrm?.Embeds.process();
    });
  }, [url]);

  return (
    <div className="flex justify-center overflow-hidden rounded-xl border border-border bg-surface-variant/30 p-1">
      <blockquote className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14" style={{ margin: 0, width: "100%" }} />
    </div>
  );
}

function TwitterEmbed({ url }: { url: string }) {
  useEffect(() => {
    loadScriptOnce("https://platform.twitter.com/widgets.js").then(() => {
      (window as unknown as { twttr?: { widgets: { load: () => void } } }).twttr?.widgets.load();
    });
  }, [url]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-variant/30 p-2">
      <blockquote className="twitter-tweet">
        <a href={url}>{url}</a>
      </blockquote>
    </div>
  );
}

export function MediaPreview({ label, url }: { label: string; url: string }) {
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    return <LinkCard label={label} url={url} />;
  }

  // Directly-hosted file (uploaded via the mobile app to our own storage) — render it natively.
  const fileKind = detectFileKind(parsed.pathname);
  if (fileKind === "video") {
    return <PreviewLabel label={label}><video src={url} controls className="max-h-[420px] w-full rounded-xl border border-border bg-black" /></PreviewLabel>;
  }
  if (fileKind === "image") {
    return <PreviewLabel label={label}><img src={url} alt={label} className="max-h-[420px] w-full rounded-xl border border-border bg-black object-contain" /></PreviewLabel>;
  }

  if (parsed.hostname.includes("drive.google.com")) {
    const fileId = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? parsed.searchParams.get("id");
    if (fileId) return <PreviewLabel label={label}><IframePreview src={`https://drive.google.com/file/d/${fileId}/preview`} /></PreviewLabel>;
  }

  if (parsed.hostname.includes("youtube.com") || parsed.hostname.includes("youtu.be")) {
    let videoId: string | null = null;
    if (parsed.hostname.includes("youtu.be")) videoId = parsed.pathname.slice(1);
    else if (parsed.pathname.startsWith("/shorts/")) videoId = parsed.pathname.split("/")[2];
    else videoId = parsed.searchParams.get("v");
    if (videoId) return <PreviewLabel label={label}><IframePreview src={`https://www.youtube.com/embed/${videoId}`} /></PreviewLabel>;
  }

  if (parsed.hostname.includes("instagram.com")) {
    return <PreviewLabel label={label}><InstagramEmbed url={url} /></PreviewLabel>;
  }

  if (parsed.hostname.includes("twitter.com") || parsed.hostname.includes("x.com")) {
    return <PreviewLabel label={label}><TwitterEmbed url={url} /></PreviewLabel>;
  }

  return <LinkCard label={label} url={url} />;
}
