"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ReturnGoodsInput } from "@/lib/validators/purchase.schema";

export default function ReturnGoodsPage({ params }: { params: { id: string } }) {
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
        receivedQty: item.receivedQty,
        returnQty: 0,
      })));
    }
  }, [po]);

  const returnMutation = useMutation({
    mutationFn: async (data: ReturnGoodsInput) => {
      const res = await fetch(`/api/purchases/${poId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to return goods");
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
    
    for (const line of lines) {
      if (line.returnQty > line.receivedQty) {
        alert(`Cannot return more than received for ${line.productName}`);
        return;
      }
    }

    const submissionLines = lines.map(l => ({
      id: l.id,
      productId: l.productId,
      returnQty: l.returnQty,
    }));

    returnMutation.mutate({ lines: submissionLines });
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
          <h1 className="text-3xl font-bold tracking-tight">Return Goods</h1>
          <p className="text-sm text-muted-foreground mt-1">Return received items to supplier for PO {po.poNumber}</p>
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
            <div className="col-span-6">Product</div>
            <div className="col-span-3 text-center">Already Received</div>
            <div className="col-span-3 text-center">Return Qty</div>
          </div>
          
          {lines.map((line, index) => {
            const isZeroReceived = line.receivedQty === 0;
            return (
              <div key={line.id} className={`grid grid-cols-12 gap-4 p-4 items-center border-b last:border-0 ${isZeroReceived ? 'bg-muted/30' : ''}`}>
                <div className="col-span-6">
                  <p className="font-medium text-sm truncate" title={line.productName}>{line.productName}</p>
                  <p className="text-xs text-muted-foreground">{line.sku}</p>
                </div>
                <div className="col-span-3 text-center font-mono text-sm">{line.receivedQty}</div>
                <div className="col-span-3">
                  <Input 
                    type="number" 
                    min="0" 
                    max={line.receivedQty}
                    value={line.returnQty} 
                    onChange={(e) => updateLine(index, "returnQty", parseInt(e.target.value) || 0)}
                    disabled={isZeroReceived}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-4">
          <Link href="/purchasing">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" variant="destructive" disabled={returnMutation.isPending || lines.every(l => l.returnQty === 0)}>
            {returnMutation.isPending ? "Processing..." : "Process Return"}
          </Button>
        </div>
      </form>
    </div>
  );
}
