/**
 * Where a clipper's format stands in the campaign, in words a brand or
 * admin reads at a glance. One place decides this so the clipper cards, the
 * status board, the two review tabs and the review window always agree.
 */

export type Stage =
  | "applied"
  | "work_review"
  | "work_rejected"
  | "awaiting_proof"
  | "proof_review"
  | "proof_rejected"
  | "awaiting_payment"
  | "paid"
  /** Proof approved where payment status isn't known (public share page). */
  | "proof_approved";

/** Outcome of the work (draft) step, for the Work Submissions tab. */
export type WorkOutcome = "work_review" | "work_rejected" | "work_approved";

export type Tag = Stage | "work_approved";

type StageInput = { status: string; paidAt?: string | null };

export const TAG_META: Record<Tag, { label: string; tone: string; dot: string; hint: string }> = {
  applied: {
    label: "Applied",
    tone: "bg-surface-variant text-muted",
    dot: "bg-zinc-400",
    hint: "Joined — no work submitted yet",
  },
  work_review: {
    label: "Under work review",
    tone: "bg-warning/15 text-warning",
    dot: "bg-yellow-400",
    hint: "Work submitted — waiting for review",
  },
  work_rejected: {
    label: "Work rejected",
    tone: "bg-destructive/15 text-destructive",
    dot: "bg-red-400",
    hint: "Waiting for the clipper to send new work",
  },
  work_approved: {
    label: "Work approved",
    tone: "bg-money/15 text-money",
    dot: "bg-emerald-400",
    hint: "Work was approved",
  },
  awaiting_proof: {
    label: "Awaiting proof of work",
    tone: "bg-primary/15 text-primary",
    dot: "bg-blue-400",
    hint: "Work approved — waiting for the live post link",
  },
  proof_review: {
    label: "Under proof of work review",
    tone: "bg-warning/15 text-warning",
    dot: "bg-orange-400",
    hint: "Live post submitted — waiting for review",
  },
  proof_rejected: {
    label: "Proof of work rejected",
    tone: "bg-destructive/15 text-destructive",
    dot: "bg-red-400",
    hint: "Waiting for the clipper to send a new live link",
  },
  awaiting_payment: {
    label: "Waiting for payment",
    tone: "bg-money-bright/15 text-money-bright",
    dot: "bg-teal-400",
    hint: "Proof approved — payout not sent yet",
  },
  paid: {
    label: "Paid",
    tone: "bg-money/15 text-money",
    dot: "bg-emerald-400",
    hint: "Payout sent",
  },
  proof_approved: {
    label: "Proof approved",
    tone: "bg-money/15 text-money",
    dot: "bg-emerald-400",
    hint: "Live post verified",
  },
};

/** Journey order, used for filters and counts. */
export const STAGE_ORDER: Stage[] = [
  "applied",
  "work_review",
  "work_rejected",
  "awaiting_proof",
  "proof_review",
  "proof_rejected",
  "awaiting_payment",
  "paid",
  "proof_approved",
];

/** Stages where the brand/admin has something to do right now. */
export const NEEDS_REVIEW: Stage[] = ["work_review", "proof_review"];

export function deliverableStage(d: StageInput): Stage {
  switch (d.status) {
    case "under_review":
      return "work_review";
    case "draft_rejected":
      return "work_rejected";
    case "draft_approved":
      return "awaiting_proof";
    case "live_submitted":
    case "proof_under_review":
      return "proof_review";
    case "proof_rejected":
      return "proof_rejected";
    case "proof_approved":
      // `undefined` = this list doesn't carry payment info at all.
      if (d.paidAt === undefined) return "proof_approved";
      return d.paidAt ? "paid" : "awaiting_payment";
    default:
      return "applied";
  }
}

/** The work step on its own — null while nothing has been submitted. Once
 * work moves on to proof, it simply reads "Work approved" here. */
export function workOutcome(d: StageInput): WorkOutcome | null {
  switch (d.status) {
    case "draft_pending":
      return null;
    case "under_review":
      return "work_review";
    case "draft_rejected":
      return "work_rejected";
    default:
      return "work_approved";
  }
}

/** The proof step on its own — null until a live link is submitted. */
export function proofOutcome(d: StageInput): Stage | null {
  const stage = deliverableStage(d);
  return ["proof_review", "proof_rejected", "awaiting_payment", "paid", "proof_approved"].includes(stage) ? stage : null;
}

export function isProofStatus(status: string): boolean {
  return ["live_submitted", "proof_under_review", "proof_approved", "proof_rejected"].includes(status);
}

export function countBy<T, K extends string>(items: T[], key: (item: T) => K | null): Partial<Record<K, number>> {
  const counts: Partial<Record<K, number>> = {};
  for (const item of items) {
    const k = key(item);
    if (k) counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}
