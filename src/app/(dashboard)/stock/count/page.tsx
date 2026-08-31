"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ClipboardCheck, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function StockCountPage() {
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [counts, setCounts] = useState<Record<string, number | "">>({});
  const [showSummary, setShowSummary] = useState(false);
  
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const router = useRouter();

  const isManagerOrAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const res = await fetch("/api/warehouses");
      return res.ok ? res.json() : [];
    },
  });

  const { data: stockList = [], isLoading } = useQuery({
    queryKey: ["stock-count-list", warehouseId],
    queryFn: async () => {
      if (!warehouseId) return [];
      const res = await fetch(`/api/stock/count?warehouseId=${warehouseId}`);
      if (!res.ok) throw new Error("Failed to fetch stock list");
      return res.json();
    },
    enabled: !!warehouseId,
  });

  // Calculate discrepancies
  const discrepancies = useMemo(() => {
    return stockList.map((item: any) => {
      const counted = counts[item.productId];
      const hasCounted = counted !== undefined && counted !== "";
      const delta = hasCounted ? (counted as number) - item.systemQuantity : 0;
      return { ...item, counted, delta, hasCounted };
    }).filter((item: any) => item.delta !== 0);
  }, [stockList, counts]);

  const mutation = useMutation({
    mutationFn: async () => {
      const corrections = discrepancies.map((d: any) => ({
        productId: d.productId,
        delta: d.delta
      }));
      
      const res = await fetch("/api/stock/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouseId, corrections }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit count");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["stock-count-list", warehouseId] });
      setCounts({});
      setShowSummary(false);
      alert("Stock count corrections applied successfully!");
    },
    onError: (err: Error) => {
      alert(err.message);
    }
  });

  const handleCountChange = (productId: string, value: string) => {
    const parsed = value === "" ? "" : parseInt(value, 10);
    setCounts(prev => ({ ...prev, [productId]: parsed }));
  };

  const handleFillUncounted = () => {
    if (confirm("This will set the counted quantity of all un-entered products to their system quantity. Proceed?")) {
      const newCounts = { ...counts };
      stockList.forEach((item: any) => {
        if (newCounts[item.productId] === undefined || newCounts[item.productId] === "") {
          newCounts[item.productId] = item.systemQuantity;
        }
      });
      setCounts(newCounts);
    }
  };

  if (session && !isManagerOrAdmin) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Unauthorized</h1>
        <p>You do not have permission to perform stock counts.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/stock">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="w-4 h-4 mr-2" /> Back to Stock
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Stock Count</h1>
      </div>

      <div className="bg-white p-6 border rounded-md shadow-sm space-y-4">
        <div className="max-w-sm space-y-2">
          <label className="text-sm font-medium">Select Warehouse to Count</label>
          <Select value={warehouseId} onValueChange={(v) => { setWarehouseId(v || ""); setCounts({}); }}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a warehouse..." />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((w: any) => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {warehouseId && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Counting Sheet</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleFillUncounted}>
                Fill uncounted with System Qty
              </Button>
              <Button 
                onClick={() => setShowSummary(true)} 
                disabled={Object.keys(counts).length === 0}
              >
                <ClipboardCheck className="w-4 h-4 mr-2" /> Review Count
              </Button>
            </div>
          </div>

          <div className="rounded-md border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">System Qty</TableHead>
                  <TableHead className="text-right w-48">Counted Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">Loading checklist...</TableCell>
                  </TableRow>
                ) : stockList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">No active products found.</TableCell>
                  </TableRow>
                ) : (
                  stockList.map((item: any) => (
                    <TableRow key={item.productId} className={counts[item.productId] !== undefined && counts[item.productId] !== "" ? "bg-muted/30" : ""}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                      <TableCell className="text-right font-medium">{item.systemQuantity}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          className="w-24 ml-auto text-right font-medium"
                          value={counts[item.productId] ?? ""}
                          onChange={(e) => handleCountChange(item.productId, e.target.value)}
                          placeholder="—"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Discrepancy Summary Modal */}
      <Dialog open={showSummary} onOpenChange={setShowSummary}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Discrepancies</DialogTitle>
          </DialogHeader>
          
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            {discrepancies.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-2xl">✓</div>
                <h3 className="text-lg font-medium">Perfect Match!</h3>
                <p className="text-muted-foreground">All counted quantities match the system records. No adjustments will be made.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-md flex gap-3 text-sm">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p>You are about to apply adjustments for <strong>{discrepancies.length}</strong> product{discrepancies.length > 1 ? 's' : ''}. This will generate stock movements with reason code "COUNT_CORRECTION".</p>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">System</TableHead>
                      <TableHead className="text-right">Counted</TableHead>
                      <TableHead className="text-right">Delta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discrepancies.map((d: any) => (
                      <TableRow key={d.productId}>
                        <TableCell className="font-medium">{d.productName}</TableCell>
                        <TableCell className="text-right">{d.systemQuantity}</TableCell>
                        <TableCell className="text-right font-bold">{d.counted}</TableCell>
                        <TableCell className={`text-right font-bold ${d.delta > 0 ? "text-green-600" : "text-red-600"}`}>
                          {d.delta > 0 ? `+${d.delta}` : d.delta}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSummary(false)}>Back to Counting</Button>
            {discrepancies.length > 0 && (
              <Button 
                onClick={() => mutation.mutate()} 
                disabled={mutation.isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {mutation.isPending ? "Applying..." : "Confirm & Adjust Stock"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
