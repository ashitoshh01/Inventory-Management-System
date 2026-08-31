"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "next-auth/react";

interface AdjustStockDialogProps {
  productId: string;
  productName: string;
  warehouses: { id: string; name: string }[];
  trigger?: React.ReactElement;
}

export function AdjustStockDialog({ productId, productName, warehouses, trigger }: AdjustStockDialogProps) {
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [reasonCode, setReasonCode] = useState<string>("");
  
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const isManagerOrAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const mutation = useMutation({
    mutationFn: async (data: { productId: string, warehouseId: string, quantity: number, reasonCode: string }) => {
      const res = await fetch("/api/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to adjust stock");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      setOpen(false);
      setWarehouseId("");
      setQuantity("");
      setReasonCode("");
    },
    onError: (err: Error) => {
      alert(err.message);
    }
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId || quantity === "" || !reasonCode) return;
    mutation.mutate({
      productId,
      warehouseId,
      quantity: Number(quantity),
      reasonCode,
    });
  };

  if (!isManagerOrAdmin) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger || <Button variant="outline" size="sm" />}>
        Adjust Stock
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock: {productName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="warehouse">Warehouse</Label>
            <Select value={warehouseId} onValueChange={(v) => setWarehouseId(v || "")} required>
              <SelectTrigger>
                <SelectValue placeholder="Select Warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity Delta (e.g., -5 or 10)</Label>
            <Input 
              id="quantity" 
              type="number" 
              value={quantity} 
              onChange={e => setQuantity(e.target.value ? parseInt(e.target.value, 10) : "")} 
              placeholder="-5 for loss, 10 for found"
              required 
            />
            <p className="text-xs text-muted-foreground">Positive numbers add stock, negative numbers reduce stock.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason Code</Label>
            <Select value={reasonCode} onValueChange={(v) => setReasonCode(v || "")} required>
              <SelectTrigger>
                <SelectValue placeholder="Select Reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAMAGE">Damage</SelectItem>
                <SelectItem value="THEFT">Theft</SelectItem>
                <SelectItem value="COUNT_CORRECTION">Count Correction</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !warehouseId || quantity === "" || !reasonCode}>
              {mutation.isPending ? "Adjusting..." : "Confirm Adjustment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
