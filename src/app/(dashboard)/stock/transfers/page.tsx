"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ArrowRightLeft } from "lucide-react";
import { TransferStockDialog } from "@/components/stock/transfer-stock-dialog";
import Link from "next/link";

export default function TransfersPage() {
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(0);
  const take = 10;

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const res = await fetch("/api/warehouses");
      return res.ok ? res.json() : [];
    },
  });

  const { data: productsData } = useQuery({
    queryKey: ["products-for-transfer"],
    queryFn: async () => {
      const res = await fetch("/api/products?take=1000"); // simplify for dropdown
      return res.ok ? res.json() : { data: [] };
    },
  });
  const products = productsData?.data || [];

  const queryParams = new URLSearchParams();
  if (warehouseId !== "all") queryParams.set("warehouseId", warehouseId);
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  queryParams.set("skip", (page * take).toString());
  queryParams.set("take", take.toString());

  const { data, isLoading } = useQuery({
    queryKey: ["transfers", warehouseId, startDate, endDate, page],
    queryFn: async () => {
      const res = await fetch(`/api/stock/transfers?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch transfers");
      return res.json();
    },
  });

  const transfers = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / take);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/stock">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="w-4 h-4 mr-2" /> Back to Stock
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Stock Transfers</h1>
        </div>
        <TransferStockDialog products={products} warehouses={warehouses} />
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <Select value={warehouseId} onValueChange={(v) => { setWarehouseId(v || "all"); setPage(0); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Warehouses</SelectItem>
            {warehouses.map((w: any) => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="flex items-center gap-2 border rounded-md px-3 bg-white h-10 shadow-sm">
          <span className="text-sm text-muted-foreground">From</span>
          <input 
            type="date" 
            className="text-sm outline-none bg-transparent"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
          />
        </div>
        
        <div className="flex items-center gap-2 border rounded-md px-3 bg-white h-10 shadow-sm">
          <span className="text-sm text-muted-foreground">To</span>
          <input 
            type="date" 
            className="text-sm outline-none bg-transparent"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
          />
        </div>
        
        {(startDate || endDate || warehouseId !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => {
            setStartDate("");
            setEndDate("");
            setWarehouseId("all");
            setPage(0);
          }}>
            Clear Filters
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>From Warehouse</TableHead>
              <TableHead>To Warehouse</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">Loading...</TableCell>
              </TableRow>
            ) : transfers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No transfers found.</TableCell>
              </TableRow>
            ) : (
              transfers.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.product.name}</span>
                      <span className="text-xs text-muted-foreground">{item.product.sku}</span>
                    </div>
                  </TableCell>
                  <TableCell>{item.fromWarehouse?.name || "-"}</TableCell>
                  <TableCell className="font-medium flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                    {item.toWarehouse?.name || "-"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {item.quantity}
                  </TableCell>
                  <TableCell>{item.user?.name || "System"}</TableCell>
                </TableRow>
              ))
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
