import { deliverableStage, NEEDS_REVIEW, type Stage } from "@/features/campaigns/lib/clipper-stage";

export type CreatorProfileSnippet = {
  platform: string;
  handle: string;
  label: string | null;
  avatarUrl?: string | null;
};

/** Minimal shape shared by both the authenticated deliverable list and the public read-only one. */
export type DeliverableForBoard = {
  id: string;
  platform: string;
  status: string;
  draftSubmittedAt: string | null;
  participationId: string;
  joinedAt: string;
  creatorId?: string;
  creatorName: string;
  creatorProfile?: CreatorProfileSnippet | null;
  priorRejectionCount: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  estimatedPaise: number;
  /** Only on the signed-in list; the public share list leaves these out. */
  draftReviewedAt?: string | null;
  livePostUrl?: string | null;
  liveSubmittedAt?: string | null;
  proofReviewedAt?: string | null;
  rejectionReason?: string | null;
  paidAt?: string | null;
  workReviewedBy?: ReviewActor | null;
  proofReviewedBy?: ReviewActor | null;
  paidBy?: ReviewActor | null;
};

/** Who made a decision on a clip. */
export type ReviewActor = { step: string; byName: string; byRole: "admin" | "team"; at: string; reason?: string | null };

const STEP_VERB: Record<string, string> = {
  work_approved: "Work approved",
  work_rejected: "Work rejected",
  proof_approved: "Proof of work approved",
  proof_rejected: "Proof of work rejected",
  paid: "Marked as paid",
};

/** "Asha (team)" / "Priya (admin)". */
export function actorLabel(a: ReviewActor): string {
  return `${a.byName} (${a.byRole})`;
}

/** "Work approved by Asha (team)". */
export function actorSentence(a: ReviewActor): string {
  return `${STEP_VERB[a.step] ?? "Updated"} by ${actorLabel(a)}`;
}

export type BoardColumn = {
  id: string;
  label: string;
  dot: string;
  stages: Stage[];
};

// Read-only pipeline — where each clipper's format stands. Rejected work
// sits with its step so it's clear which review it bounced from.
export const BOARD_COLUMNS: BoardColumn[] = [
  { id: "applied",       label: "Applied",              dot: "bg-zinc-400",    stages: ["applied"] },
  { id: "work_review",   label: "Work review",          dot: "bg-yellow-400",  stages: ["work_review", "work_rejected"] },
  { id: "awaiting_proof", label: "Awaiting proof",      dot: "bg-blue-400",    stages: ["awaiting_proof"] },
  { id: "proof_review",  label: "Proof of work review", dot: "bg-orange-400",  stages: ["proof_review", "proof_rejected"] },
  { id: "completed",     label: "Payment",              dot: "bg-emerald-400", stages: ["awaiting_payment", "paid", "proof_approved"] },
];

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const RANK_STYLE: Record<number, string> = {
  1: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  2: "bg-zinc-400/15 text-zinc-300 border-zinc-400/25",
  3: "bg-orange-500/15 text-orange-400 border-orange-500/25",
};

/** Money only counts once proof is approved — views on a rejected or
 * unreviewed post aren't earnings. */
export function approvedEarningsPaise(d: Pick<DeliverableForBoard, "status" | "estimatedPaise">): number {
  return d.status === "proof_approved" ? d.estimatedPaise : 0;
}

export type ClipperProfile = {
  participationId: string;
  creatorId?: string;
  creatorName: string;
  creatorProfile?: CreatorProfileSnippet | null;
  platforms: string[];
  joinedAt: string;
  deliverables: DeliverableForBoard[];
  /** Stage of each format, in the same order as `deliverables`. */
  stages: Stage[];
  totalViews: number;
  totalEarningsPaise: number;
  rejectionCount: number;
  lastActivityAt: string;
};

function latest(...dates: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const d of dates) if (d && (!best || d > best)) best = d;
  return best;
}

export function buildClipperProfiles(deliverables: DeliverableForBoard[]): ClipperProfile[] {
  const byParticipation = new Map<string, ClipperProfile>();
  for (const d of deliverables) {
    let entry = byParticipation.get(d.participationId);
    if (!entry) {
      entry = {
        participationId: d.participationId,
        creatorId: d.creatorId,
        creatorName: d.creatorName,
        creatorProfile: d.creatorProfile,
        platforms: [],
        joinedAt: d.joinedAt,
        deliverables: [],
        stages: [],
        totalViews: 0,
        totalEarningsPaise: 0,
        rejectionCount: 0,
        lastActivityAt: d.joinedAt,
      };
      byParticipation.set(d.participationId, entry);
    }
    if (!entry.platforms.includes(d.platform)) entry.platforms.push(d.platform);
    entry.deliverables.push(d);
    entry.stages.push(deliverableStage(d));
    entry.totalViews += d.viewCount;
    entry.totalEarningsPaise += approvedEarningsPaise(d);
    entry.rejectionCount += d.priorRejectionCount;
    entry.lastActivityAt =
      latest(entry.lastActivityAt, d.draftSubmittedAt, d.draftReviewedAt, d.liveSubmittedAt, d.proofReviewedAt, d.paidAt) ??
      entry.lastActivityAt;
  }
  // Clippers waiting on a review first, then most recent activity.
  const needsReview = (c: ClipperProfile) => c.stages.some((s) => NEEDS_REVIEW.includes(s));
  return Array.from(byParticipation.values()).sort(
    (a, b) =>
      Number(needsReview(b)) - Number(needsReview(a)) ||
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
  );
}

export type CreatorPerformance = {
  participationId: string;
  creatorId?: string;
  creatorName: string;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalEarningsPaise: number;
};

export function buildCreatorPerformance(deliverables: DeliverableForBoard[]): CreatorPerformance[] {
  const byParticipation = new Map<string, CreatorPerformance>();
  for (const d of deliverables) {
    let entry = byParticipation.get(d.participationId);
    if (!entry) {
      entry = {
        participationId: d.participationId,
        creatorId: d.creatorId,
        creatorName: d.creatorName,
        totalViews: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        totalEarningsPaise: 0,
      };
      byParticipation.set(d.participationId, entry);
    }
    entry.totalViews += d.viewCount;
    entry.totalLikes += d.likeCount;
    entry.totalComments += d.commentCount;
    entry.totalShares += d.shareCount;
    entry.totalEarningsPaise += approvedEarningsPaise(d);
  }
  return Array.from(byParticipation.values()).sort((a, b) => b.totalViews - a.totalViews);
}
