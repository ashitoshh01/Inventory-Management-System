"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft } from "lucide-react";

interface TransferStockDialogProps {
  products: { id: string; name: string; sku: string }[];
  warehouses: { id: string; name: string }[];
}

export function TransferStockDialog({ products, warehouses }: TransferStockDialogProps) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<string>("");
  const [fromWarehouseId, setFromWarehouseId] = useState<string>("");
  const [toWarehouseId, setToWarehouseId] = useState<string>("");
  const [quantity, setQuantity] = useState<number | "">("");
  
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: { productId: string, fromWarehouseId: string, toWarehouseId: string, quantity: number }) => {
      const res = await fetch("/api/stock/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to transfer stock");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      setOpen(false);
      setProductId("");
      setFromWarehouseId("");
      setToWarehouseId("");
      setQuantity("");
    },
    onError: (err: Error) => {
      alert(err.message);
    }
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !fromWarehouseId || !toWarehouseId || quantity === "") return;
    mutation.mutate({
      productId,
      fromWarehouseId,
      toWarehouseId,
      quantity: Number(quantity),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <ArrowRightLeft className="w-4 h-4 mr-2" /> New Transfer
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Stock</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="product">Product</Label>
            <Select value={productId} onValueChange={(v) => setProductId(v || "")} required>
              <SelectTrigger>
                <SelectValue placeholder="Select Product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromWarehouse">From</Label>
              <Select value={fromWarehouseId} onValueChange={(v) => setFromWarehouseId(v || "")} required>
                <SelectTrigger>
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id} disabled={w.id === toWarehouseId}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="toWarehouse">To</Label>
              <Select value={toWarehouseId} onValueChange={(v) => setToWarehouseId(v || "")} required>
                <SelectTrigger>
                  <SelectValue placeholder="Destination" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id} disabled={w.id === fromWarehouseId}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input 
              id="quantity" 
              type="number" 
              min="1"
              value={quantity} 
              onChange={e => setQuantity(e.target.value ? parseInt(e.target.value, 10) : "")} 
              placeholder="e.g. 50"
              required 
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !productId || !fromWarehouseId || !toWarehouseId || quantity === ""}>
              {mutation.isPending ? "Transferring..." : "Transfer Stock"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
