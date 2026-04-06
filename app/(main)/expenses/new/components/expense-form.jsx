"use client";

import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/hooks/use-convex-query";
import { getAllCategories } from "@/lib/expense-categories";
import { currentUser } from "@clerk/nextjs/server";
import { zodResolver } from "@hookform/resolvers/zod";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@radix-ui/react-popover";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import CategorySelector from "./category-selector";
import GroupSelector from "./group-selector";
import ParticipantSelector from "./participant-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SplitSelector from "./split-selector";

const expenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: "Amount must be a positive number",
    }),
  category: z.string().optional(),
  date: z.date(),
  paidByUserId: z.string().min(1, "Payer is required"),
  splitType: z.enum(["equal", "percentage", "exact"]),
  groupId: z.string().optional(),
});

const ExpenseForm = ({ type, onSuccess }) => {
  const [ participants, setParticipants ] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [splits, setSplits] = useState([]);

  const { data: currentUser } = useConvexQuery(api.users.getCurrentUser);
  const createExpense = useConvexMutation(api.expenses.createExpense);
  const categories = getAllCategories();

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

  const amountValue = watch("amount");
  const paidByUserId = watch("paidByUserId");

  const onSubmit = async (data) => {};

  if (!currentUser) return null;

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Lunch, movie tickets, etc..."
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-red-500">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              placeholder="0.00"
              type="number"
              step="1"
              min="0.01"
              {...register("amount")}
            />
            {errors.amount && (
              <p className="text-sm text-red-500">{errors.amount.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <CategorySelector />
          </div>

          <div className="space-y-2">
            <Label>Date</Label>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? (
                    format(selectedDate, "PPP")
                  ) : (
                    <span>Select a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className={"w-auto p-0"}>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setValue("date", date);
                  }}
                  className="rounded-md border"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {type === "group" && (
          <div className="space-y-2">
            <Label>Group</Label>
            <GroupSelector />

            {!selectedGroup && (
              <p className="text-xs text-amber-600">
                Please Select a Group to continue
              </p>
            )}
          </div>
        )}

        {type === "individual" && (
          <div className="space-y-2">
            <Label>Participants</Label>
            <ParticipantSelector />

            {participants.length <= 1 && (
              <p className="text-xs text-amber-600">
                Please Select atleast one other participant to continue
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Paid By</Label>

          <select
            {...register("paidByUserId")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select Payer</option>
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.id === currentUser._id ? "You" : participant.name}
              </option>
            ))}
          </select>

          {errors.paidByUserId && (
            <p className="text-sm text-red-500">
              {errors.paidByUserId.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Split Type</Label>
          <Tabs
            defaultValue="equal" 
            onValueChange={(value) => setValue("splitType", value)}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="equal">Equal Split</TabsTrigger>
              <TabsTrigger value="percentage">Percentage</TabsTrigger>
              <TabsTrigger value="exact">Exact Amounts</TabsTrigger>
            </TabsList>

            <TabsContent value="equal" className="pt-4">
              <p className="text-sm text-muted-foreground">
                Split the expense equally for each participant.
              </p>
              <SplitSelector />
            </TabsContent>

            <TabsContent value="percentage" className="pt-4">
              <p className="text-sm text-muted-foreground">
                Split the expense based on a percentage for each participant.
              </p>
              <SplitSelector />
            </TabsContent>

            <TabsContent value="exact" className="pt-4">
              <p className="text-sm text-muted-foreground">
                Split the expense based on the exact amount for each participant.
              </p>
              <SplitSelector />
            </TabsContent>

          </Tabs>
        </div>
      </div>


      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting 
            || (type === "group" && !selectedGroup) 
            || (type === "individual" && participants.length <= 1)}
        >
          {isSubmitting ? "Creating..." : "Create Expense"}
        </Button>
      </div>
    </form>
  );
};

export default ExpenseForm;
