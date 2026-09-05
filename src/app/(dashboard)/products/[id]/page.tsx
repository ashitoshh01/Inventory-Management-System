"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft } from "lucide-react";
import { ProductInput } from "@/lib/validators/product.schema";
import { AdjustStockDialog } from "@/components/stock/adjust-stock-dialog";

export default function ProductFormPage({ params }: { params: { id: string } }) {
  const isNew = params.id === "new";
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<ProductInput>({
    sku: "",
    barcode: "",
    name: "",
    description: "",
    categoryId: "none",
    unit: "pcs",
    costPrice: 0,
    salePrice: 0,
    reorderPoint: 0,
    reorderQty: 0,
    trackBatches: false,
    isActive: true,
    images: [],
    variants: [],
    isBundle: false,
    bundleItems: [],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const { data: allProductsData } = useQuery({
    queryKey: ["all-products"],
    queryFn: async () => {
      const res = await fetch("/api/products?take=1000");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
    enabled: formData.isBundle,
  });
  const allProducts = allProductsData?.data || [];

  const { data: existingProduct, isLoading: isLoadingProduct } = useQuery({
    queryKey: ["product", params.id],
    queryFn: async () => {
      if (isNew) return null;
      const res = await fetch(`/api/products/${params.id}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/products");
          return null;
        }
        throw new Error("Failed to fetch product");
      }
      return res.json();
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (existingProduct) {
      setFormData({
        sku: existingProduct.sku,
        barcode: existingProduct.barcode || "",
        name: existingProduct.name,
        description: existingProduct.description || "",
        categoryId: existingProduct.categoryId || "none",
        unit: existingProduct.unit,
        costPrice: Number(existingProduct.costPrice),
        salePrice: Number(existingProduct.salePrice),
        reorderPoint: existingProduct.reorderPoint,
        reorderQty: existingProduct.reorderQty,
        trackBatches: existingProduct.trackBatches,
        isActive: existingProduct.isActive,
        images: existingProduct.images || [],
        variants: existingProduct.variants || [],
        isBundle: existingProduct.isBundle || false,
        bundleItems: existingProduct.bundleItems?.map((item: any) => ({ componentId: item.componentId, quantity: item.quantity })) || [],
      });
    }
  }, [existingProduct]);

  const mutation = useMutation({
    mutationFn: async (data: ProductInput) => {
      const url = isNew ? "/api/products" : `/api/products/${params.id}`;
      const method = isNew ? "POST" : "PUT";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          categoryId: data.categoryId === "none" ? null : data.categoryId,
          barcode: data.barcode === "" ? null : data.barcode,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Something went wrong");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      router.push("/products");
    },
    onError: (err: Error) => {
      alert(err.message);
    }
  });

  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'batches'>('general');
  const [newBatch, setNewBatch] = useState({ batchNumber: '', serialNumber: '', expiryDate: '', quantity: 1, warehouseId: '' });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const res = await fetch("/api/warehouses");
      return res.ok ? res.json() : [];
    },
    enabled: !isNew,
  });

  const batchMutation = useMutation({
    mutationFn: async (data: typeof newBatch) => {
      const res = await fetch(`/api/products/${params.id}/batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          serialNumber: data.serialNumber || undefined,
          expiryDate: data.expiryDate || undefined
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add batch");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", params.id] });
      setNewBatch({ batchNumber: '', serialNumber: '', expiryDate: '', quantity: 1, warehouseId: '' });
    },
    onError: (err: Error) => alert(err.message)
  });
  
  const [attributeTypes, setAttributeTypes] = useState<{name: string, values: string}[]>([{name: '', values: ''}]);

  const handleAddAttribute = () => setAttributeTypes([...attributeTypes, {name: '', values: ''}]);
  const handleRemoveAttribute = (idx: number) => setAttributeTypes(attributeTypes.filter((_, i) => i !== idx));
  const handleAttributeChange = (idx: number, field: 'name' | 'values', value: string) => {
    const newTypes = [...attributeTypes];
    newTypes[idx][field] = value;
    setAttributeTypes(newTypes);
  };
  
  const generateVariants = () => {
    const validTypes = attributeTypes.filter(t => t.name.trim() && t.values.trim());
    if (validTypes.length === 0) return;
    
    const parsedTypes = validTypes.map(t => ({
      name: t.name.trim(),
      values: t.values.split(',').map(v => v.trim()).filter(Boolean)
    }));
    
    const cartesian = (arrays: {name: string, values: string[]}[]) => {
      return arrays.reduce<Record<string, string>[]>((acc, curr) => {
        const res: Record<string, string>[] = [];
        acc.forEach(a => {
          curr.values.forEach(v => {
            res.push({ ...a, [curr.name]: v });
          });
        });
        return res;
      }, [{}]);
    };
    
    const combos = cartesian(parsedTypes);
    const newVariants = combos.map(attrs => {
      const suffix = Object.values(attrs).map(v => String(v).toUpperCase().replace(/\s+/g, '')).join('-');
      return {
        sku: formData.sku ? `${formData.sku}-${suffix}` : suffix,
        attributes: attrs
      };
    });
    
    setFormData({ ...formData, variants: [...(formData.variants || []), ...newVariants] });
  };
  
  const updateVariantSku = (idx: number, newSku: string) => {
    const newVariants = [...(formData.variants || [])];
    newVariants[idx].sku = newSku;
    setFormData({ ...formData, variants: newVariants });
  };
  
  const removeVariant = (idx: number) => {
    const newVariants = [...(formData.variants || [])];
    newVariants.splice(idx, 1);
    setFormData({ ...formData, variants: newVariants });
  };

  const handleAddBundleItem = () => {
    setFormData({ ...formData, bundleItems: [...(formData.bundleItems || []), { componentId: "", quantity: 1 }] });
  };
  
  const updateBundleItem = (idx: number, field: 'componentId' | 'quantity', value: any) => {
    const newItems = [...(formData.bundleItems || [])];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setFormData({ ...formData, bundleItems: newItems });
  };
  
  const removeBundleItem = (idx: number) => {
    const newItems = [...(formData.bundleItems || [])];
    newItems.splice(idx, 1);
    setFormData({ ...formData, bundleItems: newItems });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setIsUploading(true);
    
    try {
      const newImages = [...(formData.images || [])];
      
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const body = new FormData();
        body.append("file", file);
        body.append("folder", "products");
        
        const res = await fetch("/api/upload", {
          method: "POST",
          body,
        });
        
        if (!res.ok) throw new Error("Upload failed");
        const { url } = await res.json();
        
        newImages.push({
          url,
          isPrimary: newImages.length === 0
        });
      }
      
      setFormData({ ...formData, images: newImages });
    } catch (e: unknown) {
      const err = e as Error;
      alert(err.message);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const setPrimaryImage = (index: number) => {
    const newImages = (formData.images || []).map((img, i) => ({
      ...img,
      isPrimary: i === index
    }));
    setFormData({ ...formData, images: newImages });
  };

  const removeImage = (index: number) => {
    const newImages = [...(formData.images || [])];
    const removed = newImages.splice(index, 1)[0];
    
    if (removed.isPrimary && newImages.length > 0) {
      newImages[0].isPrimary = true;
    }
    
    setFormData({ ...formData, images: newImages });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

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

  if (!isNew && isLoadingProduct) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/products")}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          {isNew ? "Create Product" : "Edit Product"}
        </h1>
        {!isNew && existingProduct && (
          <div className="ml-auto">
            <AdjustStockDialog 
              productId={existingProduct.id} 
              productName={existingProduct.name} 
              warehouses={warehouses}
            />
          </div>
        )}
      </div>

      <div className="flex border-b mb-6 gap-6">
        <button 
          type="button" 
          className={`pb-2 font-medium transition-colors ${activeTab === 'general' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`} 
          onClick={() => setActiveTab('general')}
        >
          General Information
        </button>
        {(!isNew && existingProduct?.trackBatches) && (
          <button 
            type="button" 
            className={`pb-2 font-medium transition-colors ${activeTab === 'batches' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`} 
            onClick={() => setActiveTab('batches')}
          >
            Batches & Expiry
          </button>
        )}
      </div>

      {activeTab === 'general' && (
      <form onSubmit={onSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" value={formData.sku} onChange={e => setFormData({ ...formData, sku: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode (Optional)</Label>
            <Input id="barcode" value={formData.barcode || ""} onChange={e => setFormData({ ...formData, barcode: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="categoryId">Category</Label>
            <Select value={formData.categoryId || "none"} onValueChange={v => setFormData({ ...formData, categoryId: v || "none" })}>
              <SelectTrigger>
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Category</SelectItem>
                {flattenedCategories.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {"\u00A0\u00A0".repeat(c.depth)}{c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit (e.g. pcs, kg)</Label>
            <Input id="unit" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} required />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="costPrice">Cost Price</Label>
            <Input id="costPrice" type="number" step="0.01" min="0" value={formData.costPrice} onChange={e => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salePrice">Sale Price</Label>
            <Input id="salePrice" type="number" step="0.01" min="0" value={formData.salePrice} onChange={e => setFormData({ ...formData, salePrice: parseFloat(e.target.value) || 0 })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reorderPoint">Reorder Point</Label>
            <Input id="reorderPoint" type="number" min="0" value={formData.reorderPoint} onChange={e => setFormData({ ...formData, reorderPoint: parseInt(e.target.value) || 0 })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reorderQty">Reorder Quantity</Label>
            <Input id="reorderQty" type="number" min="0" value={formData.reorderQty} onChange={e => setFormData({ ...formData, reorderQty: parseInt(e.target.value) || 0 })} required />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" value={formData.description || ""} onChange={e => setFormData({ ...formData, description: e.target.value })} />
        </div>

        <div className="space-y-4">
          <Label>Product Images</Label>
          
          <div className="flex flex-wrap gap-4">
            {formData.images?.map((img, idx) => (
              <div key={idx} className={`relative w-32 h-32 border rounded-md overflow-hidden ${img.isPrimary ? 'ring-2 ring-primary' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="Product" className="object-cover w-full h-full" />
                <div className="absolute top-1 right-1 flex gap-1">
                  {!img.isPrimary && (
                    <button type="button" onClick={() => setPrimaryImage(idx)} className="bg-white/80 p-1 rounded hover:bg-white text-xs" title="Set Primary">
                      🌟
                    </button>
                  )}
                  <button type="button" onClick={() => removeImage(idx)} className="bg-white/80 p-1 rounded hover:bg-white text-xs text-red-500" title="Remove">
                    ✕
                  </button>
                </div>
                {img.isPrimary && (
                  <div className="absolute bottom-0 left-0 w-full bg-primary/80 text-primary-foreground text-[10px] text-center py-0.5">
                    Primary
                  </div>
                )}
              </div>
            ))}
            <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors relative">
              <span className="text-sm font-medium text-muted-foreground">{isUploading ? "Uploading..." : "Add Image"}</span>
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
          </div>
        </div>

        <div className="space-y-4 border-t pt-6">
          <Label className="text-lg">Manage Variants</Label>
          <div className="bg-muted/50 p-4 rounded-md space-y-4">
            <h3 className="text-sm font-medium">Generate Variants</h3>
            {attributeTypes.map((attr, idx) => (
              <div key={idx} className="flex gap-4 items-start">
                <div className="flex-1 space-y-2">
                  <Input placeholder="Attribute Name (e.g. Size, Color)" value={attr.name} onChange={e => handleAttributeChange(idx, 'name', e.target.value)} />
                </div>
                <div className="flex-[2] space-y-2">
                  <Input placeholder="Values (comma separated, e.g. S, M, L)" value={attr.values} onChange={e => handleAttributeChange(idx, 'values', e.target.value)} />
                </div>
                <Button type="button" variant="ghost" className="mt-0 text-red-500" onClick={() => handleRemoveAttribute(idx)}>✕</Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleAddAttribute}>Add Attribute Type</Button>
              <Button type="button" variant="secondary" size="sm" onClick={generateVariants}>Generate Variants</Button>
            </div>
          </div>
          
          {(formData.variants?.length ?? 0) > 0 && (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground border-b">
                  <tr>
                    <th className="p-3 text-left font-medium">Variant SKU</th>
                    <th className="p-3 text-left font-medium">Attributes</th>
                    <th className="p-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.variants?.map((v, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="p-3">
                        <Input value={v.sku} onChange={e => updateVariantSku(idx, e.target.value)} className="h-8 max-w-[200px]" required />
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(v.attributes).map(([key, val]) => (
                            <span key={key} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs font-medium">
                              {key}: {String(val)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <Button type="button" variant="ghost" size="sm" className="text-red-500 h-8 px-2 hover:text-red-600 hover:bg-red-50" onClick={() => removeVariant(idx)}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formData.trackBatches} onChange={e => setFormData({ ...formData, trackBatches: e.target.checked })} />
            <span className="text-sm font-medium">Track Batches/Expiry</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formData.isBundle} onChange={e => setFormData({ ...formData, isBundle: e.target.checked })} />
            <span className="text-sm font-medium">Is Bundle/Kit</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
            <span className="text-sm font-medium">Is Active</span>
          </label>
        </div>

        {formData.isBundle && (
          <div className="space-y-4 border-t pt-6">
            <Label className="text-lg">Bundle Components</Label>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground border-b">
                  <tr>
                    <th className="p-3 text-left font-medium">Product</th>
                    <th className="p-3 text-left font-medium w-32">Quantity</th>
                    <th className="p-3 text-right font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.bundleItems?.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="p-3">
                        <Select value={item.componentId} onValueChange={v => updateBundleItem(idx, 'componentId', v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Product" />
                          </SelectTrigger>
                          <SelectContent>
                            {allProducts.filter((p: any) => p.id !== params.id).map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <Input type="number" min="1" value={item.quantity} onChange={e => updateBundleItem(idx, 'quantity', parseInt(e.target.value) || 1)} required />
                      </td>
                      <td className="p-3 text-right">
                        <Button type="button" variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => removeBundleItem(idx)}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(!formData.bundleItems || formData.bundleItems.length === 0) && (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-muted-foreground">
                        No components added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleAddBundleItem}>
              Add Component
            </Button>
          </div>
        )}

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save Product"}
        </Button>
      </form>
      )}

      {activeTab === 'batches' && !isNew && existingProduct?.trackBatches && (
        <div className="space-y-8">
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground border-b">
                <tr>
                  <th className="p-3 text-left font-medium">Batch #</th>
                  <th className="p-3 text-left font-medium">Serial #</th>
                  <th className="p-3 text-left font-medium">Expiry</th>
                  <th className="p-3 text-right font-medium">Qty</th>
                  <th className="p-3 text-left font-medium">Warehouse</th>
                  <th className="p-3 text-left font-medium">Added</th>
                </tr>
              </thead>
              <tbody>
                {existingProduct.batches?.map((b: any) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{b.batchNumber}</td>
                    <td className="p-3">{b.serialNumber || '-'}</td>
                    <td className="p-3">{b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : '-'}</td>
                    <td className="p-3 text-right">{b.quantity}</td>
                    <td className="p-3">{warehouses.find((w: any) => w.id === b.warehouseId)?.name || b.warehouseId}</td>
                    <td className="p-3">{new Date(b.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {(!existingProduct.batches || existingProduct.batches.length === 0) && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      No batches recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-muted/30 p-6 rounded-md border space-y-4">
            <h3 className="font-semibold text-lg">Add Manual Batch</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Batch Number</Label>
                <Input value={newBatch.batchNumber} onChange={e => setNewBatch({...newBatch, batchNumber: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Serial Number (Optional)</Label>
                <Input value={newBatch.serialNumber} onChange={e => setNewBatch({...newBatch, serialNumber: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date (Optional)</Label>
                <Input type="date" value={newBatch.expiryDate} onChange={e => setNewBatch({...newBatch, expiryDate: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min="1" value={newBatch.quantity} onChange={e => setNewBatch({...newBatch, quantity: parseInt(e.target.value) || 1})} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Warehouse</Label>
                <Select value={newBatch.warehouseId} onValueChange={v => setNewBatch({...newBatch, warehouseId: v || ''})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              type="button" 
              onClick={() => batchMutation.mutate(newBatch)}
              disabled={!newBatch.batchNumber || !newBatch.warehouseId || batchMutation.isPending}
            >
              {batchMutation.isPending ? "Adding..." : "Add Batch Record"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
