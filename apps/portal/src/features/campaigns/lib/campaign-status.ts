/** How a campaign status reads on badges. Only the new approval state needs
 * a friendlier name; the others already read fine as-is. */
export function campaignStatusLabel(status: string): string {
  return status === "pending_review" ? "awaiting approval" : status;
}

/** True when a brand or staff member can't edit the campaign: it's waiting
 * for an admin and must be withdrawn first. */
export function isLockedForReview(status: string, isAdmin: boolean): boolean {
  return status === "pending_review" && !isAdmin;
}
