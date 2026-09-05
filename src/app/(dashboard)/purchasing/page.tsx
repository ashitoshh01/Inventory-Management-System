"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle, PackageOpen, Undo2 } from "lucide-react";
import Link from "next/link";

export default function PurchasingPage() {
  const queryClient = useQueryClient();

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const res = await fetch("/api/purchases");
      if (!res.ok) throw new Error("Failed to fetch purchase orders");
      return res.json();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/purchases/${id}/submit`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["purchases"] });
    },
    onError: (err: Error) => alert(err.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchasing</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage purchase orders and supplier deliveries</p>
        </div>
        <Link href="/purchasing/new">
          <Button><Plus className="w-4 h-4 mr-2" /> Create PO</Button>
        </Link>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead>Expected Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[180px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
              </TableRow>
            ) : pos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No purchase orders found.</TableCell>
              </TableRow>
            ) : (
              pos.map((po: any) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.poNumber}</TableCell>
                  <TableCell>{po.supplier?.name}</TableCell>
                  <TableCell>{po.warehouse?.name}</TableCell>
                  <TableCell>{po.expectedDate ? new Date(po.expectedDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}</TableCell>
                  <TableCell>{po._count?.items || 0} items</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      po.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                      po.status === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-800' :
                      po.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {po.status.replace('_', ' ')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 items-center">
                      {po.status === 'DRAFT' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-xs h-8"
                          onClick={() => {
                            if(confirm('Submit this PO for approval?')) {
                              submitMutation.mutate(po.id);
                            }
                          }}
                          disabled={submitMutation.isPending}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Submit
                        </Button>
                      )}
                      {(po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED') && (
                        <Link href={`/purchasing/${po.id}/receive`}>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs h-8 text-blue-600 border-blue-200 hover:bg-blue-50"
                          >
                            <PackageOpen className="w-3 h-3 mr-1" />
                            Receive
                          </Button>
                        </Link>
                      )}
                      {(po.status === 'RECEIVED' || po.status === 'PARTIALLY_RECEIVED') && (
                        <Link href={`/purchasing/${po.id}/return`}>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs h-8 text-orange-600 border-orange-200 hover:bg-orange-50"
                          >
                            <Undo2 className="w-3 h-3 mr-1" />
                            Return
                          </Button>
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
