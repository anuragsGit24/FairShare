"use client"

import { api } from "@/convex/_generated/api";
import { useConvexQuery } from "@/hooks/use-convex-query";
import { currentUser } from "@clerk/nextjs/server";
import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { useForm } from "react-hook-form";
import {z} from "zod";


const expenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0 , 
    {"message": "Amount must be a positive number",
    }),
    category: z.string().optional(),
    date: z.date(),
    paidByUserId: z.string().min(1, "Payer is required"),
    splitType: z.enum(["equal", "percentage", "exact"]),
    groupId: z.string().optional(),
});

const ExpenseForm = ({ type, onSuccess }) => {
  const {data: currentUser} = useConvexQuery(api.users.getCurrentUser);

  const {
      register,
      handleSubmit,
      setValue,
      watch,
      reset,
      formState: { errors, isSubmitting },
    } = useForm({
    resolver: zodResolver(expenseSchema),
      defaultValues: {
        description: "",
        amount: "",
        category: "",
        date: new Date(),
        paidByUserId: currentUser?._id || "",
        splitType: "equal",
        groupId: undefined,
      },
    });
  

  return <div>ExpenseForm</div>
};

export default ExpenseForm;