"use client";

import React from "react"
import { useConvexQuery } from "@/hooks/use-convex-query";
import { api } from "@/convex/_generated/api";
import { BarLoader } from "react-spinners";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronRight, PlusCircle, ScanLine, Users } from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import ExpenseSummary from "./components/expense-summary";
import { BalanceSummary } from "./components/balance-summary";
import { GroupList } from "./components/group-list";
import { UpiProfileForm } from "@/components/upi-profile-form";

const DashboardPage = () => {
  const { data: balances, isLoading: balancesLoading } = useConvexQuery(api.dashboard.getUserBalances);

  const { data: groups, isLoading: groupsLoading } = useConvexQuery(api.groups.getUserGroups);

  const { data: totalSpent, isLoading: totalSpentLoading } = useConvexQuery(api.dashboard.getTotalSpent);

  const { data: monthlySpending, isLoading: monthlySpendingLoading } = useConvexQuery(api.dashboard.getMonthlySpending);

  const isLoading = balancesLoading || groupsLoading || totalSpentLoading || monthlySpendingLoading;

  return (
    <div>
      {isLoading ? (
        <div className="w-full py-12 flex justify-center">
          <BarLoader width={"100%"} color="#36d7b7" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-5xl gradient-title">Dashboard</h1>

            <div className="flex items-center gap-2 sm:gap-4">
              <UpiProfileForm />
              <Button asChild variant="outline">
                <Link href="/receipts">
                  <ScanLine className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Scan Receipt</span>
                  <span className="sm:hidden">Scan</span>
                </Link>
              </Button>
              <Button asChild className="bg-green-600 hover:bg-green-700">
                <Link href="/expenses/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Add Expense</span>
                  <span className="sm:hidden">Add</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* <div className="mt-6">
            <UpiProfileForm />
          </div> */}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {balances.totalBalance >= 0 ? (
                    <span className="text-green-600">
                      +₹{balances.totalBalance.toFixed(2)}
                    </span>
                  ) : balances?.totalBalance < 0 ? (
                    <span className="text-red-600">
                      -₹{Math.abs(balances.totalBalance).toFixed(2)}
                    </span>
                  ) : (
                    <span>₹0.00</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {balances?.totalBalance > 0
                    ? "You are owed money"
                    : balances?.totalBalance < 0
                      ? "You owe money"
                      : "All settled up!"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  You are owed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ₹{balances?.youAreOwed.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  From {balances?.oweDetails?.youAreOwedBy?.length || 0} people
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  You owe
                </CardTitle>
              </CardHeader>
              <CardContent>
                {balances?.oweDetails?.youOwe?.length > 0 ? (
                  <>
                    <div className="text-2xl font-bold text-red-600">
                      ₹{balances?.youOwe.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      To {balances?.oweDetails?.youOwe?.length || 0} people
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">₹0.00</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      You don't owe anyone
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            {/* left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Expense Summary */}
              <ExpenseSummary
                monthlySpending={monthlySpending}
                totalSpent={totalSpent}
              />
            </div>

            {/* right column */}
            <div className="space-y-6">
              {/* Balance Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Balance Details</CardTitle>
                  <Button variant="link" asChild className="p-0">
                    <Link href="/contacts">
                      View All
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <BalanceSummary balances={balances} />
                </CardContent>
              </Card>

              {/* Groups */}
              <Card>
                <CardHeader className="pb-3 flex items-center justify-between">
                  <CardTitle>Your Groups</CardTitle>
                  <Button variant="link" asChild className="p-0">
                    <Link href="/contacts">
                      View All
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <GroupList groups={groups} />
                </CardContent>
                <CardFooter>
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/contacts?createGroup=true">
                      <Users className="mr-2 h-4 w-4" />
                      Create New Group
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;