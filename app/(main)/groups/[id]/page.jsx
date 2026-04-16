"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { useConvexMutation, useConvexQuery } from "@/hooks/use-convex-query";
import { BarLoader } from "react-spinners";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlusCircle, ArrowLeftRight, ArrowLeft, Users, UserPlus, Trash2 } from "lucide-react";
import { ExpenseList } from "@/components/expense-list";
import { SettlementList } from "@/components/settlement-list";
import { GroupBalances } from "@/components/group-balances";
import { GroupMembers }  from "@/components/group-members";
import { toast } from "sonner";

export default function GroupExpensesPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("expenses");
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addingMemberId, setAddingMemberId] = useState(null);
  const [removingMemberId, setRemovingMemberId] = useState(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const groupId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { data, isLoading } = useConvexQuery(
    api.groups.getGroupExpenses,
    isDeletingGroup ? "skip" : { groupId }
  );
  const { data: currentUser } = useConvexQuery(api.users.getCurrentUser);
  const { data: searchResults, isLoading: isSearching } = useConvexQuery(
    api.users.searchUsers,
    { query: searchQuery }
  );
  const addGroupMembers = useConvexMutation(api.groups.addGroupMembers);
  const removeGroupMember = useConvexMutation(api.groups.removeGroupMember);
  const deleteGroup = useConvexMutation(api.groups.deleteGroup);

  if (isLoading || isDeletingGroup) {
    return (
      <div className="container mx-auto py-12">
        <BarLoader width={"100%"} color="#36d7b7" />
      </div>
    );
  }

  const group = data?.group;
  const members = data?.members || [];
  const expenses = data?.expenses || [];
  const settlements = data?.settlements || [];
  const balances = data?.balances || [];
  const userLookupMap = data?.userLookupMap || {};
  const isCurrentUserAdmin =
    members.find((member) => member.id === currentUser?._id)?.role === "admin";

  const existingMemberIds = new Set(members.map((member) => member.id));
  const usersAvailableToAdd = (searchResults || []).filter(
    (user) => !existingMemberIds.has(user.id)
  );

  const handleAddMember = async (user) => {
    try {
      setAddingMemberId(user.id);
      await addGroupMembers.mutate({
        groupId,
        memberIds: [user.id],
      });
      toast.success(`${user.name} added to the group`);
      setSearchQuery("");
    } catch (error) {
      toast.error(error?.message || "Failed to add member");
    } finally {
      setAddingMemberId(null);
    }
  };

  const handleRemoveMember = async (member) => {
    const confirmed = window.confirm(
      `Remove ${member.name} from this group? This only works if they have no expense/settlement history in this group.`
    );
    if (!confirmed) return;

    try {
      setRemovingMemberId(member.id);
      await removeGroupMember.mutate({
        groupId,
        userId: member.id,
      });
      toast.success(`${member.name} removed from the group`);
    } catch (error) {
      toast.error(error?.message || "Failed to remove member");
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleDeleteGroup = async () => {
    const confirmed = window.confirm(
      "Delete this group? This will permanently remove the group, expenses, and settlements for this group."
    );
    if (!confirmed) return;

    try {
      setIsDeletingGroup(true);
      await deleteGroup.mutate({ groupId });
      toast.success("Group deleted successfully");
      router.replace("/dashboard");
    } catch (error) {
      toast.error(error?.message || "Failed to delete group");
      setIsDeletingGroup(false);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          className="mb-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-4 rounded-md">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl gradient-title">{group?.name}</h1>
              <p className="text-muted-foreground">{group?.description}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {members.length} members
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {isCurrentUserAdmin && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddMemberOpen(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add members
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href={`/settlements/group/${groupId}`}>
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Settle up
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/expenses/new`}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add expense
              </Link>
            </Button>
            {isCurrentUserAdmin && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteGroup}
                disabled={isDeletingGroup || deleteGroup.isLoading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeletingGroup || deleteGroup.isLoading
                  ? "Deleting..."
                  : "Delete group"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Grid layout for group details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Group Balances</CardTitle>
            </CardHeader>
            <CardContent>
              <GroupBalances balances={balances} />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Members</CardTitle>
            </CardHeader>
            <CardContent>
              <GroupMembers
                members={members}
                canManageMembers={isCurrentUserAdmin}
                onRemoveMember={handleRemoveMember}
                removingMemberId={removingMemberId}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs for expenses and settlements */}
      <Tabs
        defaultValue="expenses"
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="expenses">
            Expenses ({expenses.length})
          </TabsTrigger>
          <TabsTrigger value="settlements">
            Settlements ({settlements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-4">
          <ExpenseList
            expenses={expenses}
            showOtherPerson={true}
            isGroupExpense={true}
            userLookupMap={userLookupMap}
          />
        </TabsContent>

        <TabsContent value="settlements" className="space-y-4">
          <SettlementList
            settlements={settlements}
            isGroupSettlement={true}
            userLookupMap={userLookupMap}
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={isAddMemberOpen}
        onOpenChange={(open) => {
          setIsAddMemberOpen(open);
          if (!open) {
            setSearchQuery("");
            setAddingMemberId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add members</DialogTitle>
            <DialogDescription>
              Search users by name or email and add them to this group.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Type at least 2 characters"
            />

            <div className="max-h-64 overflow-y-auto rounded-md border">
              {searchQuery.length < 2 ? (
                <p className="p-3 text-sm text-muted-foreground text-center">
                  Start typing to search for users.
                </p>
              ) : isSearching ? (
                <p className="p-3 text-sm text-muted-foreground text-center">
                  Searching...
                </p>
              ) : usersAvailableToAdd.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground text-center">
                  No eligible users found.
                </p>
              ) : (
                usersAvailableToAdd.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-3 p-3 border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.imageUrl} />
                        <AvatarFallback>{user.name?.charAt(0) || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAddMember(user)}
                      disabled={addingMemberId === user.id || addGroupMembers.isLoading}
                    >
                      {addingMemberId === user.id ? "Adding..." : "Add"}
                    </Button>
                  </div>
                ))
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Members with existing transactions can be viewed here. Removing members is allowed only when they have no group expense or settlement history.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}