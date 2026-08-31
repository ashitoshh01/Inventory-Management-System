"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PurchaseOrderInput } from "@/lib/validators/purchase.schema";

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [items, setItems] = useState([{ productId: "", orderedQty: 1, unitCost: 0 }]);

  // Fetch lookups
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await fetch("/api/suppliers")).json(),
  });
  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => (await fetch("/api/warehouses")).json(),
  });
  const { data: productsData } = useQuery({
    queryKey: ["products", "all"],
    queryFn: async () => (await fetch("/api/products?take=500")).json(),
  });
  const products = productsData?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: PurchaseOrderInput) => {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create PO");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      router.push("/purchasing");
    },
    onError: (err: Error) => alert(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !warehouseId) {
      alert("Please select a supplier and a warehouse.");
      return;
    }
    if (items.some(i => !i.productId)) {
      alert("Please select a product for all items.");
      return;
    }

    createMutation.mutate({
      supplierId,
      warehouseId,
      expectedDate: expectedDate || null,
      items,
    });
  };

  const addItem = () => setItems([...items, { productId: "", orderedQty: 1, unitCost: 0 }]);
  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };
  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Auto-fill cost if product selected
    if (field === 'productId') {
      const product = products.find((p: any) => p.id === value);
      if (product) {
        newItems[index].unitCost = parseFloat(product.costPrice) || 0;
      }
    }
    
    setItems(newItems);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/purchasing">
          <Button variant="outline" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Purchase Order</h1>
          <p className="text-sm text-muted-foreground mt-1">Draft a new PO to send to a supplier</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border rounded-lg bg-white">
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId} required>
              <SelectTrigger><SelectValue placeholder="Select supplier..." /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Deliver To (Warehouse)</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId} required>
              <SelectTrigger><SelectValue placeholder="Select warehouse..." /></SelectTrigger>
              <SelectContent>
                {warehouses.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Expected Date</Label>
            <Input 
              type="date" 
              value={expectedDate} 
              onChange={e => setExpectedDate(e.target.value)} 
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Order Items</h2>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-2" /> Add Item
            </Button>
          </div>

          <div className="border rounded-lg bg-white overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/50 font-medium text-sm">
              <div className="col-span-5">Product</div>
              <div className="col-span-3">Quantity</div>
              <div className="col-span-3">Unit Cost</div>
              <div className="col-span-1 text-center">Action</div>
            </div>
            
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 p-4 items-center border-b last:border-0">
                <div className="col-span-5">
                  <Select 
                    value={item.productId} 
                    onValueChange={(val) => updateItem(index, "productId", val)}
                    required
                  >
                    <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                    <SelectContent>
                      {products.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input 
                    type="number" 
                    min="1" 
                    value={item.orderedQty} 
                    onChange={(e) => updateItem(index, "orderedQty", parseInt(e.target.value) || 0)} 
                    required 
                  />
                </div>
                <div className="col-span-3 relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                  <Input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    className="pl-7"
                    value={item.unitCost === 0 ? '' : item.unitCost} 
                    onChange={(e) => updateItem(index, "unitCost", parseFloat(e.target.value) || 0)} 
                    required 
                  />
                </div>
                <div className="col-span-1 text-center">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end p-4 bg-muted/20 rounded-lg">
            <div className="text-xl font-bold">
              Total: ${items.reduce((sum, item) => sum + (item.orderedQty * item.unitCost), 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Link href="/purchasing">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Purchase Order"}
          </Button>
        </div>
      </form>
    </div>
  );
}
