import { mutation, query } from "./_generated/server"
import {internal} from "./_generated/api"
import { v } from "convex/values";

export const getAllContacts=query({
  handler: async(ctx)=>{
    const CurrentUser = await ctx.runQuery(internal.users.getCurrentUser);

    const expensesYouPaid = await ctx.db
    .query("expenses")
    .withIndex("by_user_and_group", (q) => 
      q.eq("paidByUserId", CurrentUser._id).eq("groupId", undefined)
    )
    .collect();

    const expensesnotPaidByYou = 
    (await ctx.db
    .query("expenses")
    .withIndex("by_group", (q) => 
      q.eq("groupId", undefined)
    )
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
    
    const userGroups = (await ctx.db.query("groups").collect()).filter((g) => 
      g.members
        .some((m) => m.userId === CurrentUser._id))
        .map((g) => ({
          id: g._id,
          name: g.name,
          description: g.description,
          memberCount: g.members.length,
          type:"group",
        })
  );


  //sort name alphabetically
  contactUsers.sort((a, b) => a?.name.localeCompare(b?.name));
  userGroups.sort((a, b) => a.name.localeCompare(b.name));

  return {
    contacts: contactUsers.filter(Boolean),
    groups: userGroups,
    };
  },
});

export const createGroup=mutation({
  args:{
    name: v.string(),
    description: v.optional(v.string()),
    memberIds: v.array(v.id("users")),
  },
  handler: async(ctx, args)=>{
    const CurrentUser = await ctx.runQuery(internal.users.getCurrentUser);

    if(!args.name.trim()) throw new Error("Group name cannot be empty");

    const UniqueMembers = new Set(args.memberIds);
    UniqueMembers.add(CurrentUser._id);

    for(const id of UniqueMembers){
      const user = await ctx.db.get(id);
      if(!user) throw new Error("User with id "+id+" does not exist");
    }

    return await ctx.db.insert("groups", {
      name: args.name.trim(),
      description: args.description?.trim() ?? "",
      createdBy: CurrentUser._id,
      members: [...UniqueMembers].map((id) =>({      
        userId: id, 
        role: id === CurrentUser._id ? "admin" : "member",
        joinedAt: Date.now(),
      })),
    })
  },
})

