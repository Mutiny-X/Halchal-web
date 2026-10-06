/** Platform fee charged on top of the campaign budget at checkout. Shared by
 * the Budget and Review steps so the two can never show different totals. */
export const PLATFORM_FEE_RATE = 0.15;

export function checkoutTotals(budgetRupees: number): { platformFee: number; total: number } {
  if (!Number.isFinite(budgetRupees) || budgetRupees <= 0) return { platformFee: 0, total: 0 };
  const platformFee = budgetRupees * PLATFORM_FEE_RATE;
  return { platformFee, total: budgetRupees + platformFee };
}

/** ₹1,23,456 (Indian grouping), up to 2 decimals only when needed. */
export function formatRupeeAmount(rupees: number): string {
  if (!Number.isFinite(rupees)) return "—";
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
