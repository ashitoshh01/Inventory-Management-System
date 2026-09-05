"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Search, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDebounce } from "use-debounce"; // I might need to install use-debounce, or just implement it. I'll implement a simple one or just install it. Wait, I will just install use-debounce.

export default function ProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);
  const [categoryId, setCategoryId] = useState<string>("all");
  const [isActive, setIsActive] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const take = 10;

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const queryParams = new URLSearchParams();
  if (debouncedSearch) queryParams.set("search", debouncedSearch);
  if (categoryId !== "all") queryParams.set("categoryId", categoryId);
  if (isActive !== "all") queryParams.set("isActive", isActive);
  queryParams.set("skip", (page * take).toString());
  queryParams.set("take", take.toString());

  const { data, isLoading } = useQuery({
    queryKey: ["products", debouncedSearch, categoryId, isActive, page],
    queryFn: async () => {
      const res = await fetch(`/api/products?${queryParams.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => alert(err.message),
  });

  const products = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / take);

  // Flatten categories for the dropdown to show indentation
  const flattenCategories = (cats: { id: string, name: string, parentId: string | null }[], parent: string | null = null, depth = 0): { id: string, name: string, parentId: string | null, depth: number }[] => {
    let result: { id: string, name: string, parentId: string | null, depth: number }[] = [];
    const children = cats.filter(c => c.parentId === parent);
    for (const child of children) {
      result.push({ ...child, depth });
      result = result.concat(flattenCategories(cats, child.id, depth + 1));
    }
    return result;
  };

  const flattenedCategories = flattenCategories(categories);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button variant="secondary" onClick={() => {
              localStorage.setItem("printLabelIds", JSON.stringify(selectedIds));
              window.open("/products/print-labels", "_blank");
            }}>
              <Printer className="w-4 h-4 mr-2" /> Print {selectedIds.length} Label{selectedIds.length > 1 ? 's' : ''}
            </Button>
          )}
          <Link href="/products/import">
            <Button variant="outline">Import</Button>
          </Link>
          <Link href="/products/new">
            <Button><Plus className="w-4 h-4 mr-2" /> Add Product</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, SKU, or barcode..." 
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <Select value={categoryId} onValueChange={(v) => { setCategoryId(v || "all"); setPage(0); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {flattenedCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {"\u00A0\u00A0".repeat(c.depth)}{c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={isActive} onValueChange={(v) => { setIsActive(v || "all"); setPage(0); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">
                <input 
                  type="checkbox" 
                  className="rounded border-gray-300"
                  checked={products.length > 0 && selectedIds.length === products.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(products.map((p: any) => p.id));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                />
              </TableHead>
              <TableHead className="w-16">Image</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Cost Price</TableHead>
              <TableHead>Sale Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">No products found.</TableCell>
              </TableRow>
            ) : (
              products.map((product: { id: string; sku: string; name: string; category?: { name: string }; costPrice: number | string; salePrice: number | string; isActive: boolean; images?: { url: string }[] }) => (
                <TableRow key={product.id}>
                  <TableCell className="text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300"
                      checked={selectedIds.includes(product.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(prev => [...prev, product.id]);
                        } else {
                          setSelectedIds(prev => prev.filter(id => id !== product.id));
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {product.images && product.images.length > 0 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.images[0].url} alt={product.name} className="w-10 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                        No Img
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.category?.name || "-"}</TableCell>
                  <TableCell>${Number(product.costPrice).toFixed(2)}</TableCell>
                  <TableCell>${Number(product.salePrice).toFixed(2)}</TableCell>
                  <TableCell>
                    {product.isActive ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Inactive</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => {
                        localStorage.setItem("printLabelIds", JSON.stringify([product.id]));
                        window.open("/products/print-labels", "_blank");
                      }} title="Print Label">
                        <Printer className="w-4 h-4 text-blue-500" />
                      </Button>
                      <Link href={`/products/${product.id}`}>
                        <Button variant="ghost" size="sm">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm('Are you sure you want to delete this product?')) {
                          deleteMutation.mutate(product.id);
                        }
                      }}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
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
