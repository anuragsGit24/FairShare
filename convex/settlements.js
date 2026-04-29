import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";

const ROUNDING_TOLERANCE = 0.01;

async function getOutstandingAmountBetween(ctx, { payerId, receiverId, groupId }) {
  let expenses = [];

  if (groupId) {
    expenses = await ctx.db
      .query("expenses")
      .withIndex("by_group", (q) => q.eq("groupId", groupId))
      .collect();
  } else {
    const payerPaidExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_group", (q) =>
        q.eq("paidByUserId", payerId).eq("groupId", undefined)
      )
      .collect();

    const receiverPaidExpenses = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_group", (q) =>
        q.eq("paidByUserId", receiverId).eq("groupId", undefined)
      )
      .collect();

    expenses = [...payerPaidExpenses, ...receiverPaidExpenses];
  }

  let receiverOwedByPayer = 0;

  for (const exp of expenses) {
    const payerSplit = exp.splits.find((s) => s.userId === payerId && !s.paid);
    const receiverSplit = exp.splits.find((s) => s.userId === receiverId && !s.paid);

    if (exp.paidByUserId === receiverId && payerSplit) {
      // Receiver paid this expense, payer still owes receiver.
      receiverOwedByPayer += payerSplit.amount;
    }

    if (exp.paidByUserId === payerId && receiverSplit) {
      // Payer paid this expense, so receiver owes payer (reduces opposite direction debt).
      receiverOwedByPayer -= receiverSplit.amount;
    }
  }

  const settlements = await ctx.db
    .query("settlements")
    .filter((q) =>
      q.and(
        q.eq(q.field("groupId"), groupId),
        q.or(
          q.and(
            q.eq(q.field("paidByUserId"), payerId),
            q.eq(q.field("receivedByUserId"), receiverId)
          ),
          q.and(
            q.eq(q.field("paidByUserId"), receiverId),
            q.eq(q.field("receivedByUserId"), payerId)
          )
        )
      )
    )
    .collect();

  for (const st of settlements) {
    if (st.paidByUserId === payerId && st.receivedByUserId === receiverId) {
      // Payer already paid receiver, so this debt direction decreases.
      receiverOwedByPayer -= st.amount;
    } else if (
      st.paidByUserId === receiverId &&
      st.receivedByUserId === payerId
    ) {
      // Receiver paid payer, so this debt direction increases.
      receiverOwedByPayer += st.amount;
    }
  }

  if (Math.abs(receiverOwedByPayer) <= ROUNDING_TOLERANCE) {
    return 0;
  }

  return Math.max(0, receiverOwedByPayer);
}

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

    const maxSettleAmount = await getOutstandingAmountBetween(ctx, {
      payerId: args.paidByUserId,
      receiverId: args.receivedByUserId,
      groupId: args.groupId,
    });

    if (maxSettleAmount <= ROUNDING_TOLERANCE) {
      throw new Error("No pending balance to settle in this direction");
    }

    if (args.amount - maxSettleAmount > ROUNDING_TOLERANCE) {
      throw new Error(
        `Amount exceeds pending balance. Maximum allowed is ₹${maxSettleAmount.toFixed(2)}`
      );
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

export const getSettlementData = query({
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

      // Gather one-to-one expenses where either user paid.
      const myExpenses = await ctx.db
        .query("expenses")
        .withIndex("by_user_and_group", (q) =>       
          q.eq("paidByUserId", me._id).eq("groupId", undefined)
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
          
          // Only one-to-one settlements between me and the selected counterpart.
          const settlements = await ctx.db
            .query("settlements")
            .filter((q) =>
              q.and(
                q.eq(q.field("groupId"), undefined),
                q.or(
                  q.and(
                    q.eq(q.field("paidByUserId"), me._id),
                    q.eq(q.field("receivedByUserId"), other._id)
                  ),
                  q.and(
                    q.eq(q.field("paidByUserId"), other._id),
                    q.eq(q.field("receivedByUserId"), me._id)
                  )
                )
              )
            )
            .collect();
            
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
                upiId: other.upiId,
              },
              youAreOwed: owed,
              youOwe: owing,
              netBalance: owed - owing, //positive means you receive, negative means I owe them or i should pay them
              };
      } else if(args.entityType === "group") {
          //group page
          const group = await ctx.db.get(args.entityId);
          if(!group) {
            throw new Error("Group not found");
          }

          const isMember = group.members.some((m) => m.userId === me._id);
          if(!isMember) {
            throw new Error("You are not a member of this group");
          }

          //expenses for this group
          const expenses = await ctx.db
            .query("expenses")
            .withIndex("by_group", (q) =>
              q.eq("groupId", group._id))
            .collect();

            //initialise per-member tallies
            const balances = {};
            group.members.forEach((m) => {
              if(m.userId !== me._id) {
                balances[m.userId] = {
                  owed: 0, //they owe me
                  owing: 0, //i owe them
                }
              }
            });
            

            //apply expenses 
            for(const exp of expenses) {
              if(exp.paidByUserId === me._id) {
                //i paid, others owe me
                exp.splits.forEach((split) => {
                  if(split.userId !== me._id && !split.paid) {
                    balances[split.userId].owed += split.amount;
                  }
                });
              } else if(balances[exp.paidByUserId]) {
                //someone else paid, i owe them
                const split = exp.splits.find((s) => s.userId === me._id && !s.paid);
                if(split) {
                  balances[exp.paidByUserId].owing += split.amount;
                }
              }
            }
          
          //apply settlements within this group
          const settlements = await ctx.db
            .query("settlements")
            .filter((q) => q.eq(q.field("groupId"), group._id))
            .collect();

          for(const st of settlements) {
            //we only care about settlements that involve me or ONE side is me
            if(st.paidByUserId === me._id && balances[st.receivedByUserId]) {
              //i paid them => my owing goes down
              balances[st.receivedByUserId].owing = Math.max(0, balances[st.receivedByUserId].owing - st.amount);
            }

            if(st.receivedByUserId === me._id && balances[st.paidByUserId]) {
              //they paid me => my owed goes down or their owing goes down
              balances[st.paidByUserId].owed = Math.max(0, balances[st.paidByUserId].owed - st.amount);
            }
          }

          const members = await Promise.all(
            Object.keys(balances).map((id) => ctx.db.get(id))
          );

          const list = Object.keys(balances).map((uid) => {
            const m = members.find((u) => u && u._id === uid);
            const {owed, owing} = balances[uid];
            return {
              userId: uid,
              name: m ? m.name : "Unknown",
              imageUrl: m?.imageUrl,
              upiId: m?.upiId,
              youAreOwed: owed,
              youOwe: owing,
              netBalance: owed - owing,
            }
          });  

          return {
            type: "group",
            group: {
              groupId: group._id,
              name: group.name,
              description: group.description,
            },
            balances: list,
          };
      }

      throw new Error("Invalid entity type; Expected 'user' or 'group'");      
  }
})