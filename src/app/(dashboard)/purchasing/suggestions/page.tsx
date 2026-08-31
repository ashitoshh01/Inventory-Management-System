"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Lightbulb, FilePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PurchaseOrderInput } from "@/lib/validators/purchase.schema";

export default function SuggestedPurchasesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedLines, setSelectedLines] = useState<Record<string, boolean>>({});
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [unassignedSupplierIds, setUnassignedSupplierIds] = useState<Record<string, string>>({});

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["purchase-suggestions"],
    queryFn: async () => {
      const res = await fetch("/api/purchases/suggestions");
      if (!res.ok) throw new Error("Failed to fetch suggestions");
      return res.json();
    },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => (await fetch("/api/warehouses")).json(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await fetch("/api/suppliers")).json(),
  });

  const createPoMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["purchase-suggestions"] });
      alert("Purchase Order created successfully!");
    },
    onError: (err: Error) => alert(err.message),
  });

  // Group by supplier
  const groups: Record<string, any[]> = {};
  suggestions.forEach((s: any) => {
    const key = s.suggestedSupplier?.id || "unassigned";
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  const handleGeneratePO = (supplierId: string, isUnassigned: boolean = false) => {
    if (!selectedWarehouseId) {
      alert("Please select a target warehouse first.");
      return;
    }

    const items = groups[supplierId] || [];
    const selectedItems = items.filter(i => selectedLines[i.productId]);

    if (selectedItems.length === 0) {
      alert("Please select at least one item.");
      return;
    }

    let targetSupplierId = supplierId;
    if (isUnassigned) {
      // Find the first selected unassigned item to check if we picked a supplier for it
      // Actually, if it's unassigned group, we need a supplier. 
      // Let's just use a single dropdown for the unassigned group
      targetSupplierId = unassignedSupplierIds["unassigned"];
      if (!targetSupplierId) {
        alert("Please select a supplier for the unassigned items.");
        return;
      }
    }

    createPoMutation.mutate({
      supplierId: targetSupplierId,
      warehouseId: selectedWarehouseId,
      items: selectedItems.map(i => ({
        productId: i.productId,
        orderedQty: i.reorderQty,
        unitCost: parseFloat(i.unitCost) || 0,
      }))
    });
  };

  const toggleSelect = (productId: string) => {
    setSelectedLines(prev => ({ ...prev, [productId]: !prev[productId] }));
  };

  const selectAll = (supplierId: string, select: boolean) => {
    const newSelected = { ...selectedLines };
    (groups[supplierId] || []).forEach(i => {
      newSelected[i.productId] = select;
    });
    setSelectedLines(newSelected);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/purchasing">
          <Button variant="outline" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suggested POs</h1>
          <p className="text-sm text-muted-foreground mt-1">Automatically generated reorder suggestions based on low stock</p>
        </div>
      </div>

      <div className="p-4 bg-white border rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <span className="font-medium">Global Settings</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Deliver To:</span>
          <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
            <SelectTrigger className="w-[250px]"><SelectValue placeholder="Select Warehouse..." /></SelectTrigger>
            <SelectContent>
              {warehouses.map((w: any) => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground bg-white border rounded-lg">Loading suggestions...</div>
      ) : Object.keys(groups).length === 0 ? (
        <div className="p-8 text-center text-muted-foreground bg-white border rounded-lg">No suggestions at this time. All stock levels are sufficient.</div>
      ) : (
        Object.entries(groups).map(([supplierId, items]) => {
          const isUnassigned = supplierId === "unassigned";
          const supplierName = isUnassigned ? "Unknown / Unassigned Supplier" : items[0].suggestedSupplier.name;
          
          return (
            <div key={supplierId} className="bg-white border rounded-lg overflow-hidden">
              <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{supplierName}</h3>
                  <p className="text-sm text-muted-foreground">{items.length} suggested items</p>
                </div>
                <div className="flex items-center gap-3">
                  {isUnassigned && (
                    <Select 
                      value={unassignedSupplierIds["unassigned"] || ""} 
                      onValueChange={(val) => setUnassignedSupplierIds(prev => ({...prev, unassigned: val}))}
                    >
                      <SelectTrigger className="w-[200px]"><SelectValue placeholder="Assign Supplier..." /></SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button 
                    size="sm" 
                    onClick={() => handleGeneratePO(supplierId, isUnassigned)}
                    disabled={createPoMutation.isPending || !selectedWarehouseId || items.filter(i => selectedLines[i.productId]).length === 0}
                  >
                    <FilePlus className="w-4 h-4 mr-2" /> Generate DRAFT PO
                  </Button>
                </div>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-300"
                        onChange={(e) => selectAll(supplierId, e.target.checked)}
                        checked={items.length > 0 && items.every(i => selectedLines[i.productId])}
                      />
                    </TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Reorder Point</TableHead>
                    <TableHead className="text-right">Suggested Qty</TableHead>
                    <TableHead className="text-right">Est. Unit Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.productId} className={selectedLines[item.productId] ? "bg-blue-50/50" : ""}>
                      <TableCell className="text-center">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300"
                          checked={!!selectedLines[item.productId]}
                          onChange={() => toggleSelect(item.productId)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.sku}</TableCell>
                      <TableCell className="text-right text-red-600 font-medium">{item.currentStock}</TableCell>
                      <TableCell className="text-right">{item.reorderPoint}</TableCell>
                      <TableCell className="text-right font-bold text-blue-600">{item.reorderQty}</TableCell>
                      <TableCell className="text-right">${Number(item.unitCost).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        })
      )}
    </div>
  );
}
