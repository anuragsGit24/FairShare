"use client";

import { useMemo, useRef, useState } from "react";
import { useConvexAction, useConvexMutation, useConvexQuery } from "@/hooks/use-convex-query";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ScanLine, Users } from "lucide-react";

function splitAmountEvenly(total, count) {
  const totalCents = Math.round(Number(total || 0) * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  const cents = Array.from({ length: count }, (_, idx) => base + (idx < remainder ? 1 : 0));
  return cents.map((c) => c / 100);
}

export default function ReceiptScanner() {
  const router = useRouter();
  const captureInputRef = useRef(null);
  const uploadInputRef = useRef(null);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [payerId, setPayerId] = useState("");
  const [filePreview, setFilePreview] = useState("");
  const [imageData, setImageData] = useState("");
  const [items, setItems] = useState([]);
  const [assignments, setAssignments] = useState({});

  const { data: currentUser } = useConvexQuery(api.users.getCurrentUser);
  const { data: groupData } = useConvexQuery(
    api.groups.getGroupOrMembers,
    selectedGroupId ? { groupId: selectedGroupId } : {}
  );

  const groups = groupData?.groups || [];
  const members = groupData?.selectedGroup?.members || [];

  const scanReceipt = useConvexAction(api.receipts.scanReceipt);
  const createExpense = useConvexMutation(api.expenses.createExpense);

  const canScan = Boolean(imageData && selectedGroupId);
  const isBusy = scanReceipt.isLoading || createExpense.isLoading;

  const totalDetected = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [items]
  );

  const resetParsed = () => {
    setItems([]);
    setAssignments({});
  };

  const handleGroupChange = (groupId) => {
    setSelectedGroupId(groupId);
    setPayerId("");
    resetParsed();
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = String(e.target?.result || "");
      setFilePreview(result);
      setImageData(result);
      resetParsed();
    };
    reader.readAsDataURL(file);
  };

  const openCamera = () => {
    captureInputRef.current?.click();
  };

  const openUploader = () => {
    uploadInputRef.current?.click();
  };

  const handleAnalyze = async () => {
    if (!canScan) {
      toast.error("Select a group and upload a receipt image first.");
      return;
    }

    try {
      const result = await scanReceipt.mutate({ imageData });
      const parsedItems = Array.isArray(result) ? result : [];
      setItems(parsedItems);

      const initialAssignments = {};
      parsedItems.forEach((_, idx) => {
        initialAssignments[idx] = [];
      });
      setAssignments(initialAssignments);

      if (!parsedItems.length) {
        toast.error("No line items detected. Try a clearer receipt photo.");
        return;
      }

      toast.success(`Detected ${parsedItems.length} item${parsedItems.length > 1 ? "s" : ""}.`);
    } catch (error) {
      toast.error(error.message || "Failed to analyze receipt");
    }
  };

  const toggleAssignment = (itemIndex, userId) => {
    setAssignments((prev) => {
      const selected = new Set(prev[itemIndex] || []);
      if (selected.has(userId)) selected.delete(userId);
      else selected.add(userId);
      return { ...prev, [itemIndex]: Array.from(selected) };
    });
  };

  const assignAllToMember = (itemIndex, userId) => {
    setAssignments((prev) => ({ ...prev, [itemIndex]: [userId] }));
  };

  const handleSubmit = async () => {
    if (!items.length) {
      toast.error("No items to submit.");
      return;
    }
    if (!selectedGroupId) {
      toast.error("Select a group first.");
      return;
    }
    if (!payerId) {
      toast.error("Select who paid this receipt.");
      return;
    }

    const invalidItem = items.find((_, idx) => (assignments[idx] || []).length === 0);
    if (invalidItem) {
      toast.error("Assign at least one member for every item.");
      return;
    }

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const assigned = assignments[i];
        const splitAmounts = splitAmountEvenly(item.price, assigned.length);

        const splits = assigned.map((userId, idx) => ({
          userId,
          amount: splitAmounts[idx],
          paid: false,
        }));

        await createExpense.mutate({
          description: item.name,
          amount: Number(item.price),
          category: "Other",
          date: Date.now(),
          paidByUserId: payerId,
          splitType: "exact",
          splits,
          groupId: selectedGroupId,
        });
      }

      toast.success("Receipt converted to expenses successfully.");
      setItems([]);
      setAssignments({});
      setFilePreview("");
      setImageData("");

      router.push(`/groups/${selectedGroupId}`);
    } catch (error) {
      toast.error(error.message || "Failed to submit expenses");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-green-600" />
            Scan and Split
          </CardTitle>
          <CardDescription>
            Upload a receipt photo, detect line items with AI, and assign each item to group members.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Group</label>
              <Select value={selectedGroupId} onValueChange={handleGroupChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.memberCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Paid by</label>
              <Select value={payerId} onValueChange={setPayerId}>
                <SelectTrigger className="w-full" disabled={!members.length}>
                  <SelectValue placeholder="Who paid this receipt?" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                      {currentUser?._id === member.id ? " (You)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!groups.length && (
            <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-800 p-3 text-sm">
              No groups found. Create a group first from Contacts to use the scanner.
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Receipt image</label>
              <p className="text-xs text-muted-foreground mt-1">
                Take a photo on your phone or upload an existing receipt image from your laptop.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={openCamera} className="w-full sm:w-auto">
                Take photo
              </Button>
              <Button type="button" variant="outline" onClick={openUploader} className="w-full sm:w-auto">
                Upload image
              </Button>
            </div>

            <input
              ref={captureInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="hidden"
            />
          </div>

          {filePreview ? (
            <img
              src={filePreview}
              alt="Receipt preview"
              className="w-full max-h-80 object-contain rounded-md border"
            />
          ) : null}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={handleAnalyze} disabled={!canScan || isBusy} className="sm:w-auto w-full bg-green-600 hover:bg-green-700">
              {scanReceipt.isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing receipt with AI...
                </span>
              ) : (
                "Analyze Receipt"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFilePreview("");
                setImageData("");
                resetParsed();
              }}
              disabled={isBusy}
              className="sm:w-auto w-full"
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Assign Items</span>
              <span className="text-sm text-muted-foreground font-medium">Total: Rs {totalDetected.toFixed(2)}</span>
            </CardTitle>
            <CardDescription>
              Select one or more members for each item. If multiple members are selected, amount is split equally.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, itemIndex) => (
              <div key={`${item.name}-${itemIndex}`} className="rounded-md border p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium leading-tight">{item.name}</div>
                    <div className="text-sm text-muted-foreground">Rs {Number(item.price).toFixed(2)}</div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => currentUser?._id && assignAllToMember(itemIndex, currentUser._id)}
                    disabled={!currentUser?._id}
                  >
                    Assign to me
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {members.map((member) => {
                    const checked = (assignments[itemIndex] || []).includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleAssignment(itemIndex, member.id)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                          checked
                            ? "border-green-600 bg-green-50 text-green-700"
                            : "border-border hover:border-green-300"
                        }`}
                      >
                        <Users className="h-3.5 w-3.5" />
                        {member.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="pt-2">
              <Button onClick={handleSubmit} disabled={isBusy || !payerId} className="w-full sm:w-auto bg-green-600 hover:bg-green-700">
                {createExpense.isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  "Submit Expense"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
