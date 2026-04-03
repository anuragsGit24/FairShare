import { query } from "./_generated/server";
import { v } from "convex/values";

export const getUsersWithOutstandingDebts = query({
  handler: async (ctx) => {
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
          const split = expense.splits.find(
            (s) => s.userId === user._id && !s.paid
          );
          if(!split) continue;
            
          const entry = ledger.get(expense.paidByUserId) ?? {
            amount: 0,
            since: expense.date,
          };
          entry.amount += split.amount; // user owes this amount to the payer
          entry.since = Math.min(entry.since, expense.date);
          ledger.set(expense.paidByUserId, entry);
        }
        else{
          //Case B: user has paid, and somebody else appears in splits
          for(const split of expense.splits) {
            if(split.userId === user._id || split.paid) continue; // skip self or already paid splits

            const entry = ledger.get(split.userId) ?? {
              amount: 0,
              since: expense.date,
            };
            entry.amount -= split.amount; // counterparty owes this amount to the user
            ledger.set(split.userId, entry);
          }
        }
      }

      for(const st of settlements) {
        //user paid someone -> reduce positive amount owed to that someone
        if(st.paidByUserId === user._id) {
          const entry = ledger.get(st.receivedByUserId);
          if(entry){
            entry.amount -= st.amount;
            if(entry.amount === 0) ledger.delete(st.receivedByUserId);
            else ledger.set(st.receivedByUserId, entry);
          }
        }
        //someone paid user -> reduce negative amount owed to that someone
        else if(st.receivedByUserId === user._id) {
          const entry = ledger.get(st.paidByUserId);
          if(entry){
            entry.amount += st.amount;  //entry amount is negative or zero, so we add the settlement amount to it
            if(entry.amount === 0) ledger.delete(st.paidByUserId);
            else ledger.set(st.paidByUserId, entry);
          }
        }
      }

      const debts = [];
      for(const [counterId, {amount, since}] of ledger){
        if(amount > 0) {
          const counter = await getUser(counterId);
          debts.push({
            userId: counterId,
            name: counter?.name ?? "Unknown",
            amount,
            since,
          });
        }
      }

      if(debts.length > 0) {
        result.push({
          userId: user._id,
          name: user.name,
          email: user.email,
          debts,
        });
      }
    }

    return result;
  },
})

//Get users with expenses for AI insights
export const getUsersWithExpenses = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    const result = [];

    //get current month start
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(now.getMonth() - 1);
    const monthStart = oneMonthAgo.getTime();
    

    for(const user of users) {
      const paidExpenses = await ctx.db
        .query("expenses")
        .withIndex("by_date", (q) => q.gte("date", monthStart))
        .filter((q) => q.eq(q.field("paidByUserId"), user._id))
        .collect();

      //Then check all expenses to find where user is in splits 
      //we need to do this seperately because we cant filter directly on array contents 
      const allRecentExpenses = await ctx.db
        .query("expenses")
        .withIndex("by_date", (q) => q.gte("date", monthStart))
        .collect();

      const splitExpenses = allRecentExpenses.filter(expense => 
        expense.splits.some((split) => split.userId === user._id)
      );

      const userExpenses = [...new Set([...paidExpenses, ...splitExpenses])]; //unique set of expenses where user is either payer or in splits

      if(userExpenses.length > 0) {
        result.push({
          _id: user._id,
          name: user.name,
          email: user.email,
        });
      }
    }

    return result;
  },
});

export const getUserMonthlyExpenses = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    //get current month start
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(now.getMonth() - 1);
    const monthStart = oneMonthAgo.getTime();

    //Get all expenses involving the user from the past month
    const allExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_date", (q) => q.gte("date", monthStart))
      .collect();

    //Filter for expenses where this user is involved
    const userExpenses = allExpenses.filter((expense) => {
      const isInvolved = 
        expense.paidByUserId === args.userId ||
        expense.splits.some((split) => split.userId === args.userId);
      return isInvolved;
    });

    //format expenses for AI analysis 
    return userExpenses.map((expense) => {
      //get user's share of this expense 
      const userSplit = expense.splits.find(
        (split) => split.userId === args.userId
      );

      return {
        description: expense.description,
        category: expense.category,
        date: expense.date,
        amount: userSplit ? userSplit.amount : 0, //if user is not in splits, we consider their share as 0 (they might be the payer)
        isPayer: expense.paidByUserId === args.userId,
        isGroup: expense.groupId !== undefined,     
      };
    });
  },
})

