"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ExpenseForm from "./components/expense-form";

const NewExpensePage = () => {
  const router = useRouter();

  return (
    <div>
      <div className="container max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-5xl gradient-title">Add a New Expense</h1>
          <p className="text-muted-foreground mt-1">
            Record a new expense to split with others
          </p>
        </div>

        <Card>
          <CardContent>
            <Tabs defaultValue="individual" className="pb-3">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="individual">Individual</TabsTrigger>
                <TabsTrigger value="group">Group</TabsTrigger>
              </TabsList>
              <TabsContent value="individual" className="mt-0">
                <ExpenseForm 
                type="individual" 
                onSuccess={(id) => router.push(`/person/${id}`)}
                />
              </TabsContent>
              <TabsContent value="group" className="mt-2">
                <ExpenseForm 
                  type="group" 
                  onSuccess={(id) => router.push(`/groups/${id}`)}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NewExpensePage;