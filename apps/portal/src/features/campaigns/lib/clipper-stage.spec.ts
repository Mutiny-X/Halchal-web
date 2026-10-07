import { describe, expect, it } from "vitest";

import { buildClipperProfiles, BOARD_COLUMNS, type DeliverableForBoard } from "./campaign-board-data";
import { deliverableStage, proofOutcome, STAGE_ORDER, workOutcome } from "./clipper-stage";

describe("deliverableStage", () => {
  it.each([
    ["draft_pending", null, "applied"],
    ["under_review", null, "work_review"],
    ["draft_rejected", null, "work_rejected"],
    ["draft_approved", null, "awaiting_proof"],
    ["live_submitted", null, "proof_review"],
    ["proof_under_review", null, "proof_review"],
    ["proof_rejected", null, "proof_rejected"],
    ["proof_approved", null, "awaiting_payment"],
    ["proof_approved", "2026-10-01T00:00:00Z", "paid"],
  ])("%s (paid %s) → %s", (status, paidAt, stage) => {
    expect(deliverableStage({ status, paidAt })).toBe(stage);
  });

  it("says just 'proof approved' when the list carries no payment info", () => {
    expect(deliverableStage({ status: "proof_approved" })).toBe("proof_approved");
  });
});

describe("work vs proof outcome", () => {
  it("keeps the work tab to the work step", () => {
    expect(workOutcome({ status: "draft_pending" })).toBeNull();
    expect(workOutcome({ status: "under_review" })).toBe("work_review");
    expect(workOutcome({ status: "draft_rejected" })).toBe("work_rejected");
    // Moved on to proof — the work tab only says the work was approved,
    // even when the proof itself was rejected.
    expect(workOutcome({ status: "proof_rejected" })).toBe("work_approved");
    expect(workOutcome({ status: "proof_under_review" })).toBe("work_approved");
  });

  it("keeps the proof tab to items with a live link", () => {
    expect(proofOutcome({ status: "under_review" })).toBeNull();
    expect(proofOutcome({ status: "draft_approved" })).toBeNull();
    expect(proofOutcome({ status: "proof_under_review" })).toBe("proof_review");
    expect(proofOutcome({ status: "proof_rejected" })).toBe("proof_rejected");
    expect(proofOutcome({ status: "proof_approved", paidAt: null })).toBe("awaiting_payment");
  });
});

describe("board columns", () => {
  it("place every stage in exactly one column", () => {
    for (const stage of STAGE_ORDER) {
      expect(BOARD_COLUMNS.filter((c) => c.stages.includes(stage))).toHaveLength(1);
    }
  });
});

function deliverable(overrides: Partial<DeliverableForBoard>): DeliverableForBoard {
  return {
    id: "d",
    platform: "instagram_reel",
    status: "draft_pending",
    draftSubmittedAt: null,
    participationId: "p",
    joinedAt: "2026-10-01T00:00:00Z",
    creatorName: "Asha",
    priorRejectionCount: 0,
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    estimatedPaise: 0,
    ...overrides,
  };
}

describe("buildClipperProfiles", () => {
  it("groups formats per clipper and only counts approved earnings", () => {
    const [clipper] = buildClipperProfiles([
      deliverable({ id: "a", status: "proof_approved", paidAt: null, viewCount: 1000, estimatedPaise: 500 }),
      deliverable({ id: "b", platform: "instagram_post", status: "proof_rejected", viewCount: 2000, estimatedPaise: 900, priorRejectionCount: 1 }),
    ]);
    expect(clipper.stages).toEqual(["awaiting_payment", "proof_rejected"]);
    expect(clipper.totalViews).toBe(3000);
    expect(clipper.totalEarningsPaise).toBe(500);
    expect(clipper.rejectionCount).toBe(1);
  });

  it("lists clippers waiting on a review first", () => {
    const clippers = buildClipperProfiles([
      deliverable({ id: "a", participationId: "recent", status: "draft_pending", joinedAt: "2026-10-05T00:00:00Z" }),
      deliverable({ id: "b", participationId: "waiting", status: "under_review", joinedAt: "2026-10-01T00:00:00Z", draftSubmittedAt: "2026-10-02T00:00:00Z" }),
    ]);
    expect(clippers.map((c) => c.participationId)).toEqual(["waiting", "recent"]);
  });
});
