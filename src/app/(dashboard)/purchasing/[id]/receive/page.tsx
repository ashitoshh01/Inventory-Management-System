"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ReceiveGoodsInput } from "@/lib/validators/purchase.schema";

export default function ReceiveGoodsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const poId = params.id;

  const { data: po, isLoading } = useQuery({
    queryKey: ["purchase", poId],
    queryFn: async () => {
      const res = await fetch(`/api/purchases/${poId}`);
      if (!res.ok) throw new Error("Failed to fetch PO");
      return res.json();
    },
  });

  const [lines, setLines] = useState<any[]>([]);

  useEffect(() => {
    if (po && po.items) {
      setLines(po.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        trackBatches: item.product.trackBatches,
        orderedQty: item.orderedQty,
        receivedQty: item.receivedQty,
        newReceivedQty: Math.max(0, item.orderedQty - item.receivedQty),
        batchNumber: "",
        expiryDate: "",
      })));
    }
  }, [po]);

  const receiveMutation = useMutation({
    mutationFn: async (data: ReceiveGoodsInput) => {
      const res = await fetch(`/api/purchases/${poId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to receive goods");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase", poId] });
      router.push("/purchasing");
    },
    onError: (err: Error) => alert(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate batches
    for (const line of lines) {
      if (line.newReceivedQty > 0 && line.trackBatches) {
        if (!line.batchNumber) {
          alert(`Batch number is required for ${line.productName}`);
          return;
        }
      }
    }

    const submissionLines = lines.map(l => ({
      id: l.id,
      productId: l.productId,
      newReceivedQty: l.newReceivedQty,
      batchNumber: l.batchNumber || null,
      expiryDate: l.expiryDate || null,
    }));

    receiveMutation.mutate({ lines: submissionLines });
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (!po) return <div className="p-6">PO not found</div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/purchasing">
          <Button variant="outline" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receive Goods</h1>
          <p className="text-sm text-muted-foreground mt-1">Receive items for PO {po.poNumber}</p>
        </div>
      </div>

      <div className="bg-white p-6 border rounded-lg flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Supplier</p>
          <p className="font-semibold">{po.supplier?.name}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Warehouse</p>
          <p className="font-semibold">{po.warehouse?.name}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <p className="font-semibold">{po.status}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/50 font-medium text-sm">
            <div className="col-span-3">Product</div>
            <div className="col-span-1 text-center">Ordered</div>
            <div className="col-span-1 text-center">Rcvd</div>
            <div className="col-span-2 text-center">Receive Now</div>
            <div className="col-span-5">Batch & Expiry (If tracked)</div>
          </div>
          
          {lines.map((line, index) => {
            const isFullyReceived = line.receivedQty >= line.orderedQty;
            return (
              <div key={line.id} className={`grid grid-cols-12 gap-4 p-4 items-center border-b last:border-0 ${isFullyReceived ? 'bg-muted/30' : ''}`}>
                <div className="col-span-3">
                  <p className="font-medium text-sm truncate" title={line.productName}>{line.productName}</p>
                  <p className="text-xs text-muted-foreground">{line.sku}</p>
                </div>
                <div className="col-span-1 text-center font-mono text-sm">{line.orderedQty}</div>
                <div className="col-span-1 text-center font-mono text-sm text-green-600">{line.receivedQty}</div>
                <div className="col-span-2">
                  <Input 
                    type="number" 
                    min="0" 
                    value={line.newReceivedQty} 
                    onChange={(e) => updateLine(index, "newReceivedQty", parseInt(e.target.value) || 0)}
                    disabled={isFullyReceived}
                  />
                </div>
                <div className="col-span-5">
                  {line.trackBatches && line.newReceivedQty > 0 ? (
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Batch #" 
                        value={line.batchNumber}
                        onChange={(e) => updateLine(index, "batchNumber", e.target.value)}
                        required={line.trackBatches && line.newReceivedQty > 0}
                      />
                      <Input 
                        type="date"
                        value={line.expiryDate}
                        onChange={(e) => updateLine(index, "expiryDate", e.target.value)}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      {line.trackBatches && isFullyReceived ? "Fully received" : !line.trackBatches ? "No batch tracking" : "Set Qty > 0 to enter batch"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-4">
          <Link href="/purchasing">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={receiveMutation.isPending || lines.every(l => l.newReceivedQty === 0)}>
            {receiveMutation.isPending ? "Processing..." : "Process Receipt"}
          </Button>
        </div>
      </form>
    </div>
  );
}
