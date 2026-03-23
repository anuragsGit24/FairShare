import { query } from "./_generated/server";
import { v } from "convex/values";

export const getUsersWithOutStandingDebts = query({
  handler: async () => {
    const users = await ctx.db.query("users").collect();
    const result = [];

    //load every 1-1 expense and settlement for each user
    const expenses = await ctx.db
      .query("expenses")
      .filter((q) => q.eq(q.field("groupId"), undefined))
      .collect();

    const settlements = await ctx.db
      .query("settlements")
      .filter((q) => q.eq(q.field("groupId"), undefined))
      .collect();


      const userCache = new Map();
      const getUser = async (id) => {
        if (!userCache.has(id)) userCache.set(id, await ctx.db.get(id));
        return userCache.get(id);
    };

    for(const user of users) {
      //Map<counterpartyId, {amount: number, since: number}>
      //+amount == user owes counterparty
      //-amount == counterparty owes user
      const ledger = new Map();
      for(const expense of expenses) {
        //Case A : somebody else has paid, and user appears in splits
        if(expense.paidByUserId !== user._id) {
          const split = exp.splits.find(
            (s) => s.userId === user._id && !s.paid
          );
          if(!split) continue;
            
          
        }
      }
    }
  },
})