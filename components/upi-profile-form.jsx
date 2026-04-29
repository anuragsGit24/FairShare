"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

export function UpiProfileForm() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const updateUpiId = useMutation(api.users.updateUpiId);
  
  const [upiId, setUpiId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (currentUser?.upiId) {
      setUpiId(currentUser.upiId);
    }
  }, [currentUser]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!upiId.trim()) {
      return;
    }
    
    // Basic regex validation for UPI ID
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (!upiRegex.test(upiId)) {
      setError("Please enter a valid UPI ID (e.g., username@bank)");
      return;
    }

    try {
      setIsSubmitting(true);
      await updateUpiId({ upiId });
      toast.success("UPI ID updated successfully!");
      setOpen(false); // Close dialog on success
    } catch (err) {
      setError("Failed to update UPI ID. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800">
          <Wallet className="h-4 w-4" />
          <span className="hidden sm:inline">Payment Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment Settings</DialogTitle>
          <DialogDescription>
            Add your UPI ID to receive payments directly.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="upiId">UPI ID</Label>
            <Input
              id="upiId"
              placeholder="username@bank"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter className="pt-2">
            <Button type="submit" disabled={isSubmitting || !currentUser} className="w-full bg-green-600 hover:bg-green-700">
              {isSubmitting ? "Saving..." : "Save UPI ID"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
