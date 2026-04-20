"use client";

import { useParams, useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, ArrowLeftRight, CheckCircle2, User, Users } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/hooks/use-convex-query";
import { toast } from "sonner";

const SettlementPage = () => {
  const params = useParams();
  const router = useRouter();
  const type = Array.isArray(params.type) ? params.type[0] : params.type;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [isSettleOpen, setIsSettleOpen] = useState(false);
  const [selectedCounterparty, setSelectedCounterparty] = useState(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [direction, setDirection] = useState("you_pay");

  // Fetch settlement data
  const { data, isLoading } = useConvexQuery(api.settlements.getSettlementData, {
    entityType: type,
    entityId: id,
  });
  const { data: currentUser } = useConvexQuery(api.users.getCurrentUser);
  const createSettlement = useConvexMutation(api.settlements.createSettlement);

  const netTone = useMemo(() => {
    if (!data || data.type !== "user") return "text-muted-foreground";
    if (data.netBalance > 0) return "text-green-700";
    if (data.netBalance < 0) return "text-red-700";
    return "text-green-600";
  }, [data]);

  const getCounterpartyPendingAmounts = (counterparty) => {
    if (!counterparty || !data) {
      return { youOwe: 0, youAreOwed: 0 };
    }

    if (type === "user") {
      return {
        youOwe: data.youOwe || 0,
        youAreOwed: data.youAreOwed || 0,
      };
    }

    return {
      youOwe: counterparty.youOwe || 0,
      youAreOwed: counterparty.youAreOwed || 0,
    };
  };

  const maxSettleAmount = useMemo(() => {
    const pending = getCounterpartyPendingAmounts(selectedCounterparty);
    return direction === "you_pay" ? pending.youOwe : pending.youAreOwed;
  }, [selectedCounterparty, direction, data, type]);

  const openSettleDialog = (counterparty) => {
    const defaultDirection =
      type === "user"
        ? data?.netBalance > 0
          ? "they_pay"
          : "you_pay"
        : counterparty?.netBalance > 0
          ? "they_pay"
          : "you_pay";

    setSelectedCounterparty(counterparty);
    setAmount("");
    setNote("");
    setDirection(defaultDirection);
    setIsSettleOpen(true);
  };

  const closeSettleDialog = () => {
    setIsSettleOpen(false);
    setSelectedCounterparty(null);
    setAmount("");
    setNote("");
    setDirection("you_pay");
  };

  const handleSettle = async () => {
    const parsedAmount = Number(amount);

    if (!currentUser?._id) {
      toast.error("Unable to identify current user.");
      return;
    }

    if (!selectedCounterparty?.userId) {
      toast.error("Please choose who you want to settle with.");
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount greater than 0.");
      return;
    }

    const pending = getCounterpartyPendingAmounts(selectedCounterparty);
    if (pending.youOwe <= 0 && pending.youAreOwed <= 0) {
      toast.error("No pending balance to settle.");
      return;
    }

    const allowedAmount = direction === "you_pay" ? pending.youOwe : pending.youAreOwed;
    if (allowedAmount <= 0) {
      toast.error(
        direction === "you_pay"
          ? "You do not owe this person right now."
          : "This person does not owe you right now."
      );
      return;
    }

    if (parsedAmount - allowedAmount > 0.01) {
      toast.error(`Amount exceeds pending balance. Max allowed is ₹${allowedAmount.toFixed(2)}.`);
      return;
    }

    const paidByUserId = direction === "you_pay" ? currentUser._id : selectedCounterparty.userId;
    const receivedByUserId = direction === "you_pay" ? selectedCounterparty.userId : currentUser._id;

    try {
      await createSettlement.mutate({
        amount: parsedAmount,
        note: note.trim() || undefined,
        paidByUserId,
        receivedByUserId,
        groupId: type === "group" ? data?.group?.groupId : undefined,
      });

      toast.success("Settlement recorded successfully.");
      closeSettleDialog();
    } catch (error) {
      toast.error(error?.message || "Failed to record settlement.");
    }
  };

  // Loading state
  if (isLoading || !data) {
    return (
      <div className="container mx-auto py-8 max-w-6xl px-4">
        <Button variant="outline" size="sm" onClick={() => router.back()} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="rounded-2xl border bg-card p-16 text-center text-muted-foreground">
          Loading settlement details...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl px-4 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        {type === "user" && data.counterpart && (
          <Button
            onClick={() => openSettleDialog(data.counterpart)}
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={data.netBalance === 0}
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            {data.netBalance === 0 ? "All Settled" : "Settle Up"}
          </Button>
        )}
      </div>

      <section className="rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 via-white to-teal-50 p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Badge className="bg-green-600 text-white hover:bg-green-700">
              {type === "user" ? "Individual Settlement" : "Group Settlement"}
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold gradient-title pb-0 pr-0">
              Settlement Details
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Review your balances and settle dues quickly with a clean, one-step flow.
            </p>
          </div>

          {type === "group" && data.group?.name && (
            <Card className="w-full lg:w-[360px] border-green-100 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  {data.group.name}
                </CardTitle>
                <CardDescription>{data.group.description || "Settle balances between group members."}</CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </section>

      {type === "user" && data.counterpart && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1 border-green-100">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-green-100">
                  <AvatarImage src={data.counterpart.imageUrl} />
                  <AvatarFallback>{data.counterpart.name?.charAt(0) || "?"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-base">{data.counterpart.name}</p>
                  <p className="text-xs text-muted-foreground">{data.counterpart.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-100">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">You are owed</p>
              <p className="text-2xl font-bold text-green-700 mt-1">₹{data.youAreOwed.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card className="border-green-100">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">You owe</p>
              <p className="text-2xl font-bold text-red-700 mt-1">₹{data.youOwe.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 border-green-100">
            <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Net balance</p>
                <p className={`text-3xl font-bold ${netTone}`}>₹{Math.abs(data.netBalance).toFixed(2)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {data.netBalance === 0
                    ? "You are all settled up"
                    : data.netBalance > 0
                      ? `${data.counterpart.name} owes you overall`
                      : `You owe ${data.counterpart.name} overall`}
                </p>
              </div>

              {data.netBalance === 0 && (
                <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> All settled
                </Badge>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {type === "group" && (
        <Card className="border-green-100">
          <CardHeader>
            <CardTitle className="text-xl">Group Member Balances</CardTitle>
            <CardDescription>
              Use Settle Up on any member row to record a payment instantly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.balances.map((member) => (
              <div
                key={member.userId}
                className="rounded-xl border border-green-100 bg-white p-4 flex flex-col md:flex-row md:items-center gap-4"
              >
                <div className="flex items-center gap-3 min-w-0 md:w-[280px]">
                  <Avatar className="h-10 w-10 ring-2 ring-green-100">
                    <AvatarImage src={member.imageUrl} />
                    <AvatarFallback>{member.name?.charAt(0) || "?"}</AvatarFallback>
                  </Avatar>
                  <p className="font-semibold truncate">{member.name}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 flex-1">
                  <div>
                    <p className="text-xs text-muted-foreground">You are owed</p>
                    <p className="font-semibold text-green-700">₹{member.youAreOwed.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">You owe</p>
                    <p className="font-semibold text-red-700">₹{member.youOwe.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net</p>
                    <p className={`font-semibold ${member.netBalance >= 0 ? "text-green-700" : "text-red-700"}`}>
                      ₹{member.netBalance.toFixed(2)}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => openSettleDialog(member)}
                  variant="outline"
                  className="border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
                  disabled={member.netBalance === 0}
                >
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  {member.netBalance === 0 ? "Settled" : "Settle Up"}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={isSettleOpen} onOpenChange={(open) => (open ? setIsSettleOpen(true) : closeSettleDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle Up</DialogTitle>
            <DialogDescription>
              Record a settlement with {selectedCounterparty?.name || "this person"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settlement-amount">Amount (₹)</Label>
              <Input
                id="settlement-amount"
                type="number"
                step="any"
                min="0"
                max={maxSettleAmount > 0 ? maxSettleAmount : undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                Max allowed for this direction: ₹{Math.max(0, maxSettleAmount || 0).toFixed(2)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Payment Direction</Label>
              <RadioGroup value={direction} onValueChange={setDirection} className="space-y-2">
                <Label htmlFor="you-pay" className="rounded-md border px-3 py-2 cursor-pointer hover:bg-accent">
                  <RadioGroupItem id="you-pay" value="you_pay" />
                  You paid {selectedCounterparty?.name || "them"}
                </Label>
                <Label htmlFor="they-pay" className="rounded-md border px-3 py-2 cursor-pointer hover:bg-accent">
                  <RadioGroupItem id="they-pay" value="they_pay" />
                  {selectedCounterparty?.name || "They"} paid you
                </Label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settlement-note">Note (optional)</Label>
              <Input
                id="settlement-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. UPI transfer"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeSettleDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSettle}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={createSettlement.isLoading}
            >
              {createSettlement.isLoading ? "Saving..." : "Save Settlement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettlementPage;