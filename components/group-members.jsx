"use client";

import { useConvexQuery } from "@/hooks/use-convex-query";
import { api } from "@/convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserMinus } from "lucide-react";

export function GroupMembers({
  members,
  canManageMembers = false,
  onRemoveMember,
  removingMemberId = null,
}) {
  const { data: currentUser } = useConvexQuery(api.users.getCurrentUser);

  if (!members || members.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No members in this group
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {members.map((member) => {
        const isCurrentUser = member.id === currentUser?._id;
        const isAdminMember = member.role === "admin";
        const canRemoveMember =
          canManageMembers &&
          !isCurrentUser &&
          !isAdminMember &&
          typeof onRemoveMember === "function";

        return (
          <div key={member.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={member.imageUrl} />
                <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {isCurrentUser ? "You" : member.name}
                  </span>
                  {isCurrentUser && (
                    <Badge variant="outline" className="text-xs py-0 h-5">
                      You
                    </Badge>
                  )}
                </div>
                  {isAdminMember && (
                  <span className="text-xs text-muted-foreground">Admin</span>
                )}
              </div>
            </div>

              {canRemoveMember && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => onRemoveMember(member)}
                  disabled={removingMemberId === member.id}
                >
                  <UserMinus className="h-4 w-4" />
                  <span className="sr-only">Remove member</span>
                </Button>
              )}
          </div>
        );
      })}
    </div>
  );
}