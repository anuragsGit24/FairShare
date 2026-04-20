"use client";

import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/hooks/use-convex-query";
import { getAllCategories } from "@/lib/expense-categories";
import { zodResolver } from "@hookform/resolvers/zod";
import React, { useEffect, useState } from "react";
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
import { SplitSelector } from "./split-selector";
import { toast } from "sonner";

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
  splitType: z.enum(["equal", "percentage", "exact", "full"]),
  groupId: z.string().optional(),
});

const ExpenseForm = ({ type, onSuccess }) => {
  const [ participants, setParticipants ] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [splits, setSplits] = useState([]);
  const [fullResponsibilityUserId, setFullResponsibilityUserId] = useState("");

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

  //when a user is added or removed, update the participant list 
  useEffect(() => {
    if (participants.length === 0 && currentUser) {
      //always add the current user as a participant by default
      setParticipants([
        {
          id: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          imageUrl: currentUser.imageUrl,
        },
      ]);
    }
  }, [currentUser, participants]);

  useEffect(() => {
    if (participants.length === 0) {
      setFullResponsibilityUserId("");
      return;
    }

    const stillValid = participants.some(
      (participant) => participant.id === fullResponsibilityUserId
    );

    if (!stillValid) {
      const fallbackId = participants.some((participant) => participant.id === paidByUserId)
        ? paidByUserId
        : currentUser && participants.some((participant) => participant.id === currentUser._id)
          ? currentUser._id
          : participants[0].id;

      setFullResponsibilityUserId(fallbackId);
    }
  }, [participants, fullResponsibilityUserId, paidByUserId, currentUser]);
    
  const onSubmit = async (data) => {
    try{
      const amount = parseFloat(data.amount);

      let formattedSplits = [];

      if (data.splitType === "full") {
        if (!fullResponsibilityUserId) {
          toast.error("Please select who is responsible for this expense.");
          return;
        }

        formattedSplits = participants.map((participant) => ({
          userId: participant.id,
          amount: participant.id === fullResponsibilityUserId ? amount : 0,
          paid: participant.id === data.paidByUserId,
        }));
      } else {
        //prepare splits in the format expected by the API
        formattedSplits = splits.map((split) => ({
          userId: split.userId,
          amount: split.amount,
          paid: split.userId === data.paidByUserId,
        }));
      }

      //validate that splits add up to the total amount for exact split type
      const totalSplitAmount = formattedSplits.reduce((sum, split) => sum + split.amount, 0);

      const tolerance = 0.01; // Allow a small tolerance for floating point precision issues

      if(Math.abs(totalSplitAmount - amount) > tolerance){
        toast.error(
          `The total split amount (₹${totalSplitAmount.toFixed(2)}) does not equal the total expense amount (₹${amount.toFixed(2)}). Please adjust the splits.`
        );
        return;
      }

      const groupId = type === "individual" ? undefined : data.groupId;
      //create the expense using the API
      await createExpense.mutate({
        description: data.description,
        amount: amount,
        category: data.category || "Other",
        date: data.date.getTime(), // convert to timestamp
        paidByUserId: data.paidByUserId,
        splitType: data.splitType,
        splits: formattedSplits,
        groupId,
      });

      toast.success("Expense created successfully!");
      reset(); //reset form
      
      const otherParticipant = participants.find((p) => p.id !== currentUser._id
      );
      const otherUserId = otherParticipant?.id;
      onSuccess(type === "individual" ? otherUserId : groupId); //notify parent to refresh list or navigate
    } catch (error) {
      toast.error("Failed to create expense: " + error.message);
    }
  };

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
            <CategorySelector categories={categories || []} 
            onChange={(categoryId) => {
              if(categoryId){
                setValue("category", categoryId);
              }
            }}
            />
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
            <GroupSelector onChange={(group) => {
              //only update if the group has changed to prevent loops
              if(!selectedGroup || selectedGroup.id !== group.id){
                setSelectedGroup(group);
                setValue("groupId", group.id);

                //update participants with the group members 
                if(group.members && Array.isArray(group.members)){
                  //set the participants once, dont reset if they are the same
                  setParticipants(group.members);
                }
              }
            }}/>

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
            <ParticipantSelector 
              participants={participants}
              onParticipantsChange={setParticipants}
            />

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
            <TabsList className={`grid w-full ${type === "individual" ? "grid-cols-4" : "grid-cols-3"}`}>
              <TabsTrigger value="equal">Equal Split</TabsTrigger>
              <TabsTrigger value="percentage">Percentage</TabsTrigger>
              <TabsTrigger value="exact">Exact Amounts</TabsTrigger>
              {type === "individual" && (
                <TabsTrigger value="full">Single Person</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="equal" className="pt-4">
              <p className="text-sm text-muted-foreground">
                Split the expense equally for each participant.
              </p>
              <SplitSelector 
                type="equal"
                amount={parseFloat(amountValue) || 0}
                participants={participants}
                paidByUserId={paidByUserId}
                onSplitsChange={setSplits}
              />
            </TabsContent>

            <TabsContent value="percentage" className="pt-4">
              <p className="text-sm text-muted-foreground">
                Split the expense based on a percentage for each participant.
              </p>
              <SplitSelector 
                type="percentage"
                amount={parseFloat(amountValue) || 0}
                participants={participants}
                paidByUserId={paidByUserId}
                onSplitsChange={setSplits}
              />
            </TabsContent>

            <TabsContent value="exact" className="pt-4">
              <p className="text-sm text-muted-foreground">
                Split the expense based on the exact amount for each participant.
              </p>
              <SplitSelector 
                type="exact"
                amount={parseFloat(amountValue) || 0}
                participants={participants}
                paidByUserId={paidByUserId}
                onSplitsChange={setSplits}
              />
            </TabsContent>

            {type === "individual" && (
              <TabsContent value="full" className="pt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Assign 100% of this expense to one person. Useful when only one person is responsible.
                </p>

                <div className="space-y-2">
                  <Label>Responsible Person</Label>
                  <select
                    value={fullResponsibilityUserId}
                    onChange={(event) => setFullResponsibilityUserId(event.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select person</option>
                    {participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.id === currentUser._id ? "You" : participant.name}
                      </option>
                    ))}
                  </select>
                </div>

                <SplitSelector
                  type="full"
                  amount={parseFloat(amountValue) || 0}
                  participants={participants}
                  paidByUserId={paidByUserId}
                  responsibleUserId={fullResponsibilityUserId}
                  onSplitsChange={setSplits}
                />
              </TabsContent>
            )}

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
