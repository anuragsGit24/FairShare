"use client";

import { useState } from "react";
import { useConvexQuery } from "@/hooks/use-convex-query";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpCircle, ArrowDownCircle, ArrowRight, Zap, Sparkles } from "lucide-react";

/**
 * Expected `balances` shape (one object per member):
 * {
 *   id:           string;           // user id
 *   name:         string;
 *   imageUrl?:    string;
 *   totalBalance: number;           // + ve ⇒ they are owed, – ve ⇒ they owe
 *   owes:   { to: string;   amount: number }[];  // this member → others
 *   owedBy: { from: string; amount: number }[];  // others → this member
 * }
 */
export function GroupBalances({ balances, groupId }) {
  const { data: currentUser } = useConvexQuery(api.users.getCurrentUser);
  const [mode, setMode] = useState("detailed"); // "detailed" | "simplified"

  // Only fetch simplified data when the toggle is active
  const { data: simplifiedData, isLoading: isSimplifiedLoading } =
    useConvexQuery(
      api.groups.getSimplifiedBalances,
      mode === "simplified" && groupId ? { groupId } : "skip"
    );

  /* ───── guards ────────────────────────────────────────────────────────── */
  if (!balances?.length || !currentUser) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No balance information available
      </div>
    );
  }

  /* ───── helpers ───────────────────────────────────────────────────────── */
  const me = balances.find((b) => b.id === currentUser._id);
  if (!me) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        You're not part of this group
      </div>
    );
  }

  const userMap = Object.fromEntries(balances.map((b) => [b.id, b]));

  // Who owes me?
  const owedByMembers = me.owedBy
    .map(({ from, amount }) => ({ ...userMap[from], amount }))
    .sort((a, b) => b.amount - a.amount);

  // Whom do I owe?
  const owingToMembers = me.owes
    .map(({ to, amount }) => ({ ...userMap[to], amount }))
    .sort((a, b) => b.amount - a.amount);

  const isAllSettledUp =
    me.totalBalance === 0 &&
    owedByMembers.length === 0 &&
    owingToMembers.length === 0;

  /* ───── UI ────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* ── Mode toggle ──────────────────────────────────────────────── */}
      {groupId && (
        <Tabs value={mode} onValueChange={setMode} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="detailed">Detailed</TabsTrigger>
            <TabsTrigger value="simplified">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Simplify Debts
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* ── Simplified view ──────────────────────────────────────────── */}
      {mode === "simplified" ? (
        <SimplifiedView
          data={simplifiedData}
          isLoading={isSimplifiedLoading}
          currentUserId={currentUser._id}
        />
      ) : (
        /* ── Detailed (original) view ──────────────────────────────── */
        <>
          {/* Current user's total balance */}
          <div className="text-center pb-4 border-b">
            <p className="text-sm text-muted-foreground mb-1">Your balance</p>
            <p
              className={`text-2xl font-bold ${
                me.totalBalance > 0
                  ? "text-green-600"
                  : me.totalBalance < 0
                    ? "text-red-600"
                    : ""
              }`}
            >
              {me.totalBalance > 0
                ? `+₹${me.totalBalance.toFixed(2)}`
                : me.totalBalance < 0
                  ? `-₹${Math.abs(me.totalBalance).toFixed(2)}`
                  : "₹0.00"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {me.totalBalance > 0
                ? "You are owed money"
                : me.totalBalance < 0
                  ? "You owe money"
                  : "You are all settled up"}
            </p>
          </div>

          {isAllSettledUp ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground">Everyone is settled up!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* People who owe the current user */}
              {owedByMembers.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium flex items-center mb-3">
                    <ArrowUpCircle className="h-4 w-4 text-green-500 mr-2" />
                    Owed to you
                  </h3>
                  <div className="space-y-3">
                    {owedByMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.imageUrl} />
                            <AvatarFallback>
                              {member.name?.charAt(0) ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{member.name}</span>
                        </div>
                        <span className="font-medium text-green-600">
                          ₹{member.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* People the current user owes */}
              {owingToMembers.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium flex items-center mb-3">
                    <ArrowDownCircle className="h-4 w-4 text-red-500 mr-2" />
                    You owe
                  </h3>
                  <div className="space-y-3">
                    {owingToMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.imageUrl} />
                            <AvatarFallback>
                              {member.name?.charAt(0) ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{member.name}</span>
                        </div>
                        <span className="font-medium text-red-600">
                          ₹{member.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SimplifiedView — renders the output of getSimplifiedBalances
 * ═══════════════════════════════════════════════════════════════════════════ */
function SimplifiedView({ data, isLoading, currentUserId }) {
  if (isLoading) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        Calculating simplified debts…
      </div>
    );
  }

  const transactions = data?.transactions ?? [];
  const rawTransactionCount = data?.rawTransactionCount ?? 0;
  const simplifiedTransactionCount = data?.simplifiedTransactionCount ?? 0;

  if (transactions.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground">Everyone is settled up! 🎉</p>
      </div>
    );
  }

  const pluralize = (count, word) => count === 1 ? word : `${word}s`;

  // Only show banner if there's an actual reduction
  const hasSavings = simplifiedTransactionCount < rawTransactionCount;

  return (
    <div className="space-y-4">
      {/* ── Summary banner (only if savings exist) ──────────────────────────────────────────── */}
      {hasSavings && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                Magic! Reduced <span className="font-bold">{rawTransactionCount}</span>{" "}
                {pluralize(rawTransactionCount, "transaction")} down to{" "}
                <span className="font-bold">{simplifiedTransactionCount}</span>{" "}
                {pluralize(simplifiedTransactionCount, "transaction")}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Transaction list ──────────────────────────────────────────── */}
      <div className="space-y-3">
        {transactions.map((t, idx) => {
          const isFromMe = t.from.id === currentUserId;
          const isToMe = t.to.id === currentUserId;

          return (
            <div
              key={idx}
              className={`flex items-center justify-between rounded-lg border p-3 ${
                isFromMe
                  ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20"
                  : isToMe
                    ? "border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20"
                    : ""
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* FROM */}
                <Avatar className="h-7 w-7">
                  <AvatarImage src={t.from.imageUrl} />
                  <AvatarFallback>
                    {t.from.name?.charAt(0) ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium truncate">
                  {isFromMe ? "You" : t.from.name}
                </span>

                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                {/* TO */}
                <Avatar className="h-7 w-7">
                  <AvatarImage src={t.to.imageUrl} />
                  <AvatarFallback>
                    {t.to.name?.charAt(0) ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium truncate">
                  {isToMe ? "You" : t.to.name}
                </span>
              </div>

              <span
                className={`font-semibold whitespace-nowrap ml-2 ${
                  isFromMe
                    ? "text-red-600"
                    : isToMe
                      ? "text-green-600"
                      : ""
                }`}
              >
                ₹{t.amount.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}