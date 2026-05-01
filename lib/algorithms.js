/**
 * Debt Simplification — Minimum Cash Flow (Greedy)
 *
 * Algorithm overview:
 * 1. Accept a balance map  { userId: netBalance }
 *    – positive  → the user is a creditor (is owed money)
 *    – negative  → the user is a debtor  (owes money)
 *    – zero      → settled, skip
 *
 * 2. Separate users into two lists: creditors and debtors.
 *
 * 3. Sort creditors descending by amount, debtors ascending (most negative
 *    first) so the largest mismatch is resolved first.
 *
 * 4. Greedily match the largest debtor with the largest creditor:
 *    – transfer = min(|debtor balance|, creditor balance)
 *    – Reduce both balances by that transfer amount.
 *    – When either reaches zero (within ε), move to the next.
 *
 * 5. Continue until all balances are zeroed out.
 *
 * Complexity: O(n log n)  (dominated by the initial sort)
 *
 * @param {Record<string, number>} balanceMap – userId → net balance
 * @returns {{ from: string, to: string, amount: number }[]}
 */
export function simplifyDebts(balanceMap) {
  const EPSILON = 0.01; // ½ cent tolerance for floating-point dust
  const round2 = (n) => Math.round(n * 100) / 100;

  // ── 1. Build creditor / debtor lists ──────────────────────────────────
  const creditors = []; // { id, amount }  (amount > 0)
  const debtors = [];   // { id, amount }  (amount < 0, stored as positive)

  for (const [id, raw] of Object.entries(balanceMap)) {
    const bal = round2(raw);
    if (bal > EPSILON) {
      creditors.push({ id, amount: bal });
    } else if (bal < -EPSILON) {
      debtors.push({ id, amount: -bal }); // store as positive for easier math
    }
    // bal ≈ 0 → already settled, skip
  }

  // Sort so the largest values come first
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // ── 2. Greedy matching ────────────────────────────────────────────────
  const transactions = [];
  let ci = 0; // creditor index
  let di = 0; // debtor index

  while (ci < creditors.length && di < debtors.length) {
    const transfer = round2(Math.min(debtors[di].amount, creditors[ci].amount));

    if (transfer > EPSILON) {
      transactions.push({
        from: debtors[di].id,  // who pays
        to: creditors[ci].id,  // who receives
        amount: transfer,
      });
    }

    debtors[di].amount = round2(debtors[di].amount - transfer);
    creditors[ci].amount = round2(creditors[ci].amount - transfer);

    if (debtors[di].amount <= EPSILON) di++;
    if (creditors[ci]?.amount <= EPSILON) ci++;
  }

  return transactions;
}
