import { v } from "convex/values";
import {query} from "./_generated/server";

export const getExpensesBetweenUsers = query({
  args: {userId: v.id("users")},
  handler:async (ctx, {userId}) => {
    const me = await ctx.runQuery(internal.users.getCurrentUser);

    if(me._id === userId) throw new Error("Cannot get expenses with yourself");

    // 1. One one one expenses where either user is payer or participant, and that are not part of a group

    const myPaid = await ctx.db
    .query("expenses")
    .withIndex("by_user_and_group", (q) =>
      q.eq("paidByUserId", me._id).eq("groupId", undefined)
    )
    .collect();

    const theirPaid = await ctx.db
    .query("expenses")
    .withIndex("by_user_and_group", (q) =>
      q.eq("paidByUserId", userId).eq("groupId", undefined)
    )
    .collect();
    
    const candidateExpenses = [...myPaid, ...theirPaid];

    //2.  keep only those where both users are involved
    const expenses = candidateExpenses.filter((e) =>{
      //me is always involved (i am payer OR in splits - verified below)
      const meInSplits = e.splits.some((s) => s.userId === me._id);
      const themInSplits  = e.splits.some((s) => s.userId === userId);

      const meInvolved = e.paidByUserId === me._id || meInSplits;
      const themInvolved = e.paidByUserId === userId || themInSplits;

      return meInvolved && themInvolved;
    });

    expenses.sort((a,b) => b.date - a.date); //newest first

    // 3. Settlements between the two us (groupId = undefined)
    const settlements = await ctx.db
      .query("settlements")
      .filter((q) => q.and(
        q.eq(q.field("groupId"), undefined),
        q.or(
          q.and(
            q.eq(q.field("paidByUserId"), me._id),
            q.eq(q.field("receivedByUserId"), userId)
          ),
          q.and(
            q.eq(q.field("paidByUserId"), userId),
            q.eq(q.field("receivedByUserId"), me._id)
          )
        )
      )
    )
    .collect();

    settlements.sort((a,b) => b.date - a.date); //newest first

    // 4. Compute running balance
    let balance = 0;

    for await (const e of expenses) {
      if(e.paidByUserId === me._id){
        const split = e.splits.find((s) => s.userId === userId && !s.paid);
        if(split) balance += split.amount; //they owe me
      } else{
        const split = e.splits.find((s) => s.userId === me._id && !s.paid);
        if(split) balance -= split.amount; //i owe them
      }
    }
  }, 
})  