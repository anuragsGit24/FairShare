import { v } from "convex/values";
import { internal } from "./_generated/api";

export const createSettlement = mutation({
  args: {
    amount: v.number(),
    note: v.optional(v.string()),
    paidByUserId: v.id("users"),
    receivedByUserId: v.id("users"),
    groupId: v.optional(v.id("groups")), //undefined when settlement is one to one
    relatedExpenseIds: v.optional(v.array(v.id("expenses"))),
  },
  handler: async(ctx, args) => {
    const caller = await ctx.runQuery(internal.users.getCurrentUser);

    //basic validation
    if (args.amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    if (args.paidByUserId === args.receivedByUserId) {
      throw new Error("Cannot create settlement to self");
    }

    if(
      caller._id !== args.paidByUserId &&
      caller._id !== args.receivedByUserId
    ) {
      throw new Error("Caller must be either the payer or the receiver of the settlement");
    }

    //group check (if provided)
    if (args.groupId) {
      const group = await ctx.db.get(args.groupId);
      if (!group) {
        throw new Error("Group not found");
      }

      const isMember = (uid) => group.members.some((m) => m.userId === uid);
      if (!isMember(args.paidByUserId) || !isMember(args.receivedByUserId)) {
        throw new Error("Both payer and receiver must be members of the group");
      }
    }

    return await ctx.db.insert("settlements", {
      amount: args.amount,
      note: args.note,
      date: Date.now(),    //server side timsetamp to prevent manipulation
      paidByUserId: args.paidByUserId,
      receivedByUserId: args.receivedByUserId,
      groupId: args.groupId,
      relatedExpenseIds: args.relatedExpenseIds,
      createdBy: caller._id,
    });
  }
})

export const getSSettlementData = query({
  args: {
    entityType: v.string(), // "user" or "group"
    entityId: v.string(),  //convex_id (stringform) of the user or group
  },
  handler: async(ctx, args) => {
    const me = await ctx.runQuery(internal.users.getCurrentUser);

    if(args.entityType === "user") {
      ////user page
      const other = await ctx.db.get(args.entityId);
      if(!other) {
        throw new Error("User not found");
      }

      //gather expenses where either of us paid or appears in splits 
      const myExpenses = await ctx.db
        .query("expenses")
        .withIndex("by_user_and_group", (q) =>       
          q.eq("paidByUserId", me._id).eq("groupId", null) //one to one expenses
        ).collect();

        const otherUserExpenses = await ctx.db
        .query("expenses")
        .withIndex("by_user_and_group", (q) =>
          q.eq("paidByUserId", other._id).eq("groupId", undefined) //one to one expenses
        ).collect();

        const expenses = [...myExpenses, ...otherUserExpenses];

        let owed = 0; //they owe me
        let owing = 0; //i owe them

        for(const exp of expenses) {
          const involvesMe = 
            exp.paidByUserId === me._id ||
            exp.splits.some((s) => s.userId === me._id);
          const involvesThem = 
            exp.paidByUserId === other._id ||
            exp.splits.some((s) => s.userId === other._id);

            if(!involvesMe || !involvesThem) {
              continue; //skip expenses that don't involve both of us
            }

            //case1: I paid, they owe me
            if(exp.paidByUserId === me._id) {
              const split = exp.splits.find((s) => s.userId === other._id && !s.paid);
              if(split) {
                owed += split.amount;
              }
            }

            //case2: they paid, I owe them
            if(exp.paidByUserId === other._id) {
              const split = exp.splits.find((s) => s.userId === me._id && !s.paid);
              if(split) {
                owing += split.amount;
              }
            }
          }
          
          const mySettlements = await ctx.db
            .query("settlements")
            .withIndex("by_user_and_group", (q) =>
              q.eq("paidByUserId", me._id).eq("groupId", undefined)
            ).collect();

          const otherUserSettlements = await ctx.db
            .query("settlements")
            .withIndex("by_user_and_group", (q) =>
              q.eq("paidByUserId", other._id).eq("groupId", undefined)
            ).collect();

            const settlements = [...mySettlements, ...otherUserSettlements];
            
            for(const st of settlements) {
              if(st.paidByUserId === me._id ) {
                //i paid them => my owing goes down
                owing = Math.max(0, owing - st.amount);
              } else {
                //they paid me => my owed goes down or their owing goes down
                owed = Math.max(0, owed - st.amount);
              }
            }

            return {
              type: "user",
              counterpart: {
                userId: other._id,
                name: other.name,
                email: other.email,
                imageUrl: other.imageUrl,
              },
              youAreOwed: owed,
              youOwe: owing,
              netBalance: owed - owing, //positive means you receive, negative means I owe them or i should pay them
              };
      } else if(args.entityType === "group") {
        
      }
  }
})