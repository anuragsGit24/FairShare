# Debt Simplification — Implementation Walkthrough

## Summary

Added a **Simplify Debts** feature to FairShare groups that reduces N pairwise debts into the mathematically minimum number of transfers — all computed on-the-fly without touching the database schema or existing queries.

---

## Files Changed

### [NEW] [algorithms.js](file:///c:/Users/LOQ/Desktop/FairShare/FairShare/lib/algorithms.js)

Pure, framework-agnostic greedy algorithm:

1. Separates users into **creditors** (positive balance) and **debtors** (negative balance)
2. Sorts both lists largest-first
3. Iteratively matches the biggest debtor with the biggest creditor, transferring `min(debt, credit)`
4. Repeats until all balances are zeroed

All arithmetic uses `Math.round(n * 100) / 100` to prevent floating-point dust. An `EPSILON` of `0.01` skips sub-cent residuals.

**Input:** `{ userId: netBalance }` — **Output:** `[{ from, to, amount }]`

---

### [MODIFY] [groups.js](file:///c:/Users/LOQ/Desktop/FairShare/FairShare/convex/groups.js)

Two additive-only changes:

1. **Import** — `import { simplifyDebts } from "../lib/algorithms.js";` (line 4)
2. **New query** — `getSimplifiedBalances` (appended at EOF)
   - Takes `groupId`, verifies membership
   - Fetches all group expenses + settlements (same pattern as `getGroupExpenses`)
   - Computes net balance per user into a `totals` map
   - Passes `totals` through `simplifyDebts()`
   - Enriches each transaction with user `name` and `imageUrl`
   - Returns `{ transactions: [{ from: {id, name, imageUrl}, to: {…}, amount }] }`

> [!NOTE]
> Zero existing queries were modified. This is purely additive.

---

### [MODIFY] [group-balances.jsx](file:///c:/Users/LOQ/Desktop/FairShare/FairShare/components/group-balances.jsx)

- Added a **Tabs** toggle (`Detailed` / `⚡ Simplify Debts`) at the top of the card
- **Detailed tab** — renders the original balance view, completely unchanged in logic
- **Simplified tab** — lazily calls `getSimplifiedBalances` only when toggled on; renders each optimized transfer as a card with:
  - From-avatar → arrow → To-avatar
  - Red background tint if the current user is the payer
  - Green background tint if the current user is the receiver
  - "Optimized to N transfers" summary at the top
- Falls back gracefully when `groupId` is absent (no toggle shown)

---

### [MODIFY] [page.jsx](file:///c:/Users/LOQ/Desktop/FairShare/FairShare/app/(main)/groups/[id]/page.jsx)

Single-line change — passes `groupId` as a prop to `<GroupBalances>`:

```diff
-<GroupBalances balances={balances} />
+<GroupBalances balances={balances} groupId={groupId} />
```

---

## Verification

- No schema changes — existing expenses/settlements flow is untouched
- Algorithm is a pure function — can be unit-tested with any `{ id: balance }` map
- Simplified query is lazy — only fetched when the user toggles the view
- Floating-point precision handled via `round2()` + epsilon checks throughout
