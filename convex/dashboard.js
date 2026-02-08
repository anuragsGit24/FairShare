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
      (e.paidByUserId === user.id ||
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
    const youAreOwedList = []; //List of who owes you and how much
  },
});