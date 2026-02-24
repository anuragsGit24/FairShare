import { api } from "@/convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/hooks/use-convex-query";
import { getCategoryById, getCategoryIcon } from "@/lib/expense-categories";
import React from "react";

const ExpenseList = ({
  expenses,
  showOtherPerson = true,
  isGroupExpense = false,
  otherPersonId = null,
  userLookupMap = {},
}) => {
  const { data: currentUser } = useConvexQuery(api.users.getCurrentUser);
  const deleteExpense = useConvexMutation(api.expenses.deleteExpense);

  if(!expenses || expenses.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No Expenses Found
        </CardContent>
      </Card>
    );
  }


  const getUserDetails = (userId) => {
    return {
      name:
        userId === currentUser?._id ? "You" : userLookupMap[userId]?.name || "Other User",
      // imageUrl:null,
      id: userId,
    };
  };

  return (
    <div className="flex flex-col gap-4">
      {expenses.map((expense) => {
        const payer = getUserDetails(expense.paidByUserId);
        const isCurrentUserPayer = expense.paidByUserId === currentUser?._id; 
        const category = getCategoryById(expense.category);
        const CategoryIcon = getCategoryIcon(category.id);
        
      })}
    </div>
  );
};

export default ExpenseList;