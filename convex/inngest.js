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
          for(const split of exp.splits) {
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