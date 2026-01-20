import { query } from "./_generated/server"
import {internal} from "./_generated/api"

export const getAllContacts=query({
  handler: async(ctx)=>{
    const CurrentUser = await ctx.runQuery(internal.users.getCurrentUser);

    const expensesYouPaid = await ctx.db.query("expenses").withIndex("by_user_and_group", (q) => {
      q.eq("paidByUserId", CurrentUser._id).eq("groupId", undefined);
    })
    .collect();

    const expensesnotPaidByYou = 
    (await ctx.db
    .query("expenses")
    .withIndex("by_group", (q) => {
      q.eq("groupId", undefined);
    })
    .collect())
    .filter((e) => 
      e.paidByUserId !=  CurrentUser._id && 
      e.splits.some(s => s.userId===CurrentUser._id));

    const personalExpenses = [...expensesYouPaid, ...expensesnotPaidByYou];

    const contactIds = new Set();
    personalExpenses.forEach((exp) => {
      if(exp.paidByUserId !== CurrentUser._id)
        contactIds.add(exp.paidByUserId);

      exp.splits.forEach((s) => {
        if(s.userId !== CurrentUser._id) contactIds.add(s.userId);
      });
    });

    const contactUsers = await Promise.all(
      [...contactIds].map(async(id) => {
        const u = await ctx.db.get(id);

        return u 
        ? {
          id : u._id,
          name: u.name,
          email: u.email,
          imageUrl: u.imageUrl,
          type: "user",
        }
        : null
      })
    );

    
  },
});