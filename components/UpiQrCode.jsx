"use client";

import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function UpiQrCode({ payeeVpa, payeeName, amount }) {
  const [copied, setCopied] = useState(false);

  // Construct standard UPI URI format
  // upi://pay?pa={payeeVpa}&pn={payeeName}&am={amount}&cu=INR
  const upiUri = `upi://pay?pa=${encodeURIComponent(payeeVpa)}&pn=${encodeURIComponent(
    payeeName
  )}&am=${amount.toFixed(2)}&cu=INR`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(upiUri);
      setCopied(true);
      toast.success("UPI Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-card rounded-xl shadow-sm border">
      <div className="bg-white p-2 rounded-lg">
        <QRCodeSVG
          value={upiUri}
          size={200}
          level="H"
          includeMargin={true}
        />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">Scan to Pay via UPI</p>
        <p className="text-xs text-muted-foreground break-all">{payeeVpa}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full flex items-center gap-2 mt-2"
        onClick={copyToClipboard}
      >
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied Link" : "Copy UPI Link"}
      </Button>
    </div>
  );
}
