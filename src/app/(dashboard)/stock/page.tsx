"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { useDebounce } from "use-debounce";
import { AdjustStockDialog } from "@/components/stock/adjust-stock-dialog";
import Link from "next/link";

export default function StockPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [page, setPage] = useState(0);
  const take = 10;

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const res = await fetch("/api/warehouses");
      if (!res.ok) throw new Error("Failed to fetch warehouses");
      return res.json();
    },
  });

  const queryParams = new URLSearchParams();
  if (debouncedSearch) queryParams.set("search", debouncedSearch);
  if (warehouseId !== "all") queryParams.set("warehouseId", warehouseId);
  queryParams.set("skip", (page * take).toString());
  queryParams.set("take", take.toString());

  const { data, isLoading } = useQuery({
    queryKey: ["stock", debouncedSearch, warehouseId, page],
    queryFn: async () => {
      const res = await fetch(`/api/stock?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch stock");
      return res.json();
    },
  });

  const stockLevels = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / take);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Stock Levels</h1>
        <div className="flex gap-2">
          <Link href="/stock/count">
            <Button variant="outline">Stock Count</Button>
          </Link>
          <Link href="/stock/transfers">
            <Button variant="outline">Transfer History</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by product name or SKU..." 
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <Select value={warehouseId} onValueChange={(v) => { setWarehouseId(v || "all"); setPage(0); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Warehouses</SelectItem>
            {warehouses.map((w: any) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Bin Location</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">Loading...</TableCell>
              </TableRow>
            ) : stockLevels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No stock records found.</TableCell>
              </TableRow>
            ) : (
              stockLevels.map((item: any) => {
                const available = item.quantity - item.reservedQty;
                const isLowStock = item.quantity <= item.product.reorderPoint;
                
                return (
                  <TableRow key={item.id} className={isLowStock ? "bg-red-50 hover:bg-red-100/50 transition-colors" : ""}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium flex items-center gap-2">
                          {item.product.name}
                          {isLowStock && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        </span>
                        <span className="text-xs text-muted-foreground">{item.product.sku}</span>
                      </div>
                    </TableCell>
                    <TableCell>{item.warehouse.name}</TableCell>
                    <TableCell>{item.binLocation || "-"}</TableCell>
                    <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{item.reservedQty}</TableCell>
                    <TableCell className={`text-right font-bold ${isLowStock ? "text-red-600" : ""}`}>
                      {available}
                    </TableCell>
                    <TableCell className="text-right">
                      <AdjustStockDialog 
                        productId={item.product.id} 
                        productName={item.product.name} 
                        warehouses={warehouses}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-medium">
            Page {page + 1} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
