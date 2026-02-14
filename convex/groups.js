import { query } from "./_generated/server";
import { internal } from "./_generated/api";

export const getUserGroups = query({
  handler: async (ctx) => {
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    const groups = await ctx.db
      .query("groups")
      .collect()
      .then(groups =>
        groups.filter(group =>
          group.members.some(member => member.userId === currentUser._id)
        )
      );

    // Calculate balance for each group
    const groupsWithBalance = await Promise.all(
      groups.map(async (group) => {
        // Get expenses for this group
        const expenses = await ctx.db
          .query("expenses")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .collect();

        // Get settlements for this group
        const settlements = await ctx.db
          .query("settlements")
          .withIndex("by_group", (q) => q.eq("groupId", group._id))
          .collect();

        let balance = 0;

        // Calculate from expenses
        for (const expense of expenses) {
          const isPayer = expense.paidByUserId === currentUser._id;
          const mySplit = expense.splits.find(s => s.userId === currentUser._id);

          if (isPayer) {
            // User paid, so they're owed by others
            for (const split of expense.splits) {
              if (split.userId !== currentUser._id && !split.paid) {
                balance += split.amount;
              }
            }
          } else if (mySplit && !mySplit.paid) {
            // User didn't pay, so they owe
            balance -= mySplit.amount;
          }
        }

        // Calculate from settlements
        for (const settlement of settlements) {
          if (settlement.paidByUserId === currentUser._id) {
            // User paid settlement, so they received money
            balance += settlement.amount;
          } else if (settlement.receivedByUserId === currentUser._id) {
            // User received settlement, so they got money
            balance += settlement.amount;
          }
        }

        return {
          id: group._id,
          name: group.name,
          description: group.description,
          memberCount: group.members.length,
          role: group.members.find(member => member.userId === currentUser._id)?.role || "member",
          createdAt: group.members.find(member => member.userId === currentUser._id)?.joinedAt,
          balance: balance,
        };
      })
    );

    return groupsWithBalance;
  },
});