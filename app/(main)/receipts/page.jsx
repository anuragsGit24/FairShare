"use client";

import ReceiptScanner from "@/components/receipt-scanner";

const ReceiptsPage = () => {
  return (
    <div className="container max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-5xl gradient-title">Smart Receipt Scanner</h1>
        <p className="text-muted-foreground mt-1">
          Upload a receipt, let AI detect line items, assign each item to members, and create expenses instantly.
        </p>
      </div>

      <ReceiptScanner />
    </div>
  );
};

export default ReceiptsPage;
