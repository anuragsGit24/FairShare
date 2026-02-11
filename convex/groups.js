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

    return groups.map(group => ({
      id: group._id,
      name: group.name,
      description: group.description,
      memberCount: group.members.length,
      role: group.members.find(member => member.userId === currentUser._id)?.role || "member",
      createdAt: group.members.find(member => member.userId === currentUser._id)?.joinedAt,
    }));
  },
});