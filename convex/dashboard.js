import { internal } from "./_generated/api";
import { query } from "./_generated/server";

//Get User balances
export const getUserBalances = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    //1-1 expenses
    //Get all expenses where the user is either the payer or a participant, and that are not part of a group
    const expenses = (await ctx.db.query("expenses").collect()).filter(
      (e) =>
        !e.groupId &&
      (e.paidByUserId === user._id ||
        e.splits.some((s) => s.userId === user._id))
    );


    let youOwe = 0;    //You owe others
    let youAreOwed = 0; //Others owe you
    const balanceByUserId = {};  //detailed balance by user

    for(const e of expenses){
      const isPayer = e.paidByUserId === user._id;
      const mySplit = e.splits.find((s) => s.userId === user._id);
      
      if(isPayer){
        for(const s of e.splits){
          if(s.userId === user._id || s.paid) continue; //skip yourself

          youAreOwed += s.amount;
          (balanceByUserId[s.userId] ??= {owed: 0, owing: 0}).owed += s.amount;
        }
      } else if(mySplit && !mySplit.paid){
        //someone else paid, and user hasn't paid their split yet
        youOwe += mySplit.amount;
        (balanceByUserId[e.paidByUserId] ??= {owed: 0, owing: 0}).owing += mySplit.amount;
      }
    }
    
    //1 to 1 settlements(no groupId)
    //Get settlements that directly involve the user, either as payer or receiver, and that are not part of a group
    const settlements = (await ctx.db.query("settlements").collect()).filter(
      (s) =>
        !s.groupId &&
        (s.paidByUserId === user._id || s.receivedByUserId === user._id)
    );

    for(const s of settlements){
      if(s.paidByUserId === user._id){
        //user paid someone else -> reduce what they owe
        youOwe -= s.amount;
        (balanceByUserId[s.receivedByUserId] ??= {owed: 0, owing: 0}).owing -= s.amount;
    } else if(s.receivedByUserId === user._id){
        //user received payment from someone else -> reduce what they are owed
        youAreOwed -= s.amount;
        (balanceByUserId[s.paidByUserId] ??= {owed: 0, owing: 0}).owed -= s.amount;
      }
    }


    const youOweList = []; //List of who you owe and how much
    const youAreOwedByList = []; //List of who owes you and how much

    for(const [uid, {owed, owing}] of Object.entries(balanceByUserId)){
      const net = owed - owing; //calculate net balance
      if(net === 0) continue;

      const counterpart = await ctx.db.get(uid);
      const base = {
        userId: uid,
        name: counterpart?.name ?? "Unknown",
        imageUrl: counterpart?.imageUrl,
        amount: Math.abs(net),
      };

      net > 0 ? youAreOwedByList.push(base) : youOweList.push(base);
    }

    youOweList.sort((a, b) => b.amount - a.amount);
    youAreOwedByList.sort((a, b) => b.amount - a.amount);

    return {
      youOwe, //total amount user owes
      youAreOwed, // total amount owed to user
      totalBalance: youAreOwed - youOwe, //net balance
      oweDetails: {youOwe:youOweList, youAreOwedBy : youAreOwedByList},
    }
  },
});


export const getTotalSpent = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).getTime();

    const expenses = await ctx.db
    .query("expenses")
    .withIndex("by_date", (q) => q.gte("date", startOfYear))
    .collect();

    const userExpenses = expenses.filter(
      (expenses) =>
        expenses.paidByUserId === user._id ||
        expenses.splits.some((split) => split.userId === user._id)
    );

    let totalSpent = 0
    userExpenses.forEach((expense) => {
      const userSplit = expense.splits.find((split) => split.userId === user._id);

      if(userSplit){
        totalSpent += userSplit.amount;
      }
    })
    return totalSpent;
  }
});

export const getMonthlySpending = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).getTime();

    const expenses = await ctx.db
    .query("expenses")
    .withIndex("by_date", (q) => q.gte("date", startOfYear))
    .collect();

    const userExpenses = expenses.filter(
      (expenses) =>
        expenses.paidByUserId === user._id ||
        expenses.splits.some((split) => split.userId === user._id)
    );

    const monthlyTotals = {};

    for(let i = 0; i < 12; i++){
      const monthDate = new Date(currentYear, i, 1);
      monthlyTotals[monthDate.getTime()] = 0;
    }
      
      userExpenses.forEach((expense) => {
        const date = new Date(expense.date);

        const monthStart = new Date(
          date.getFullYear(),
          date.getMonth(),
          1
          ).getTime();
      
          const userSplit = expense.splits.find((split) => split.userId === user._id);

          if(userSplit){
            monthlyTotals[monthStart] += (monthlyTotals[monthStart] || 0) + userSplit.amount;
          }
      });
      const result = Object.entries(monthlyTotals).map(([month, total]) => ({
        month: parseInt(month),
        total, 
      }));
      
      //sort by month (chronologically)
      result.sort((a, b) => a.month - b.month);
      return result;
  },
});


export const getUserGroups = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);

    //get all groups from database
    const allGroups = await ctx.db.query("groups").collect();

    //filter groups to those where user is a member
    const groups = allGroups.filter((group) => group.members.some((member) => member.userId === user._id));

    const enhancedGroups = await Promise.all(
      groups.map(async(group) => {
        const expenses = await ctx.db
        .query("expenses")
        .withIndex("by_groupId", (q) => q.eq("groupId", group._id))
        .collect();

        let balance = 0;

        expenses.forEach((expense) => {
          if(expense.paidByUserId === user._id){
            expense.splits.forEach((split) => {
              if(split.userId != user._id && !split.paid){
                balance += split.amount; //user is owed this amount
              } 
            });
          } else {
            //someone else paid - user may owe them
            const userSplit = expense.splits.find((split) => split.userId === user._id);

            //subtract amount the user owes others
            if(userSplit && !userSplit.paid){
              balance -= userSplit.amount;
            }
          }
        });

        //apply settlements to adjust balance
        const settlements = await ctx.db
        .query("settlements")
        .filter((q) =>
          q.and(
            q.eq(q.field("groupId"), group._id),
            q.or(
              q.eq(q.field("paidByUserId"), user._id),
              q.eq(q.field("receivedByUserId"), user._id)
            )
          )
        )
        .collect();

        settlements.forEach((settlement) => {
          if(settlement.paidByUserId === user._id){
            balance += settlement.amount; //user paid someone else, reduce what they owe
          } else{
            balance -= settlement.amount; //user received payment, reduce what they are owed
          }
      })

        return {
          ...group,
          id: group._id,
          balance, //positive means group owes user, negative means user owes group
        };
      })
    );

    return enhancedGroups;
  },
});


