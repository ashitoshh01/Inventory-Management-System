"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Download, Upload } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ProductInput } from "@/lib/validators/product.schema";
import { validateBulkProducts, ParsedRow } from "@/lib/bulk-validation";

export default function BulkImportPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  const csvTemplate = "sku,barcode,name,description,categoryId,unit,costPrice,salePrice,reorderPoint,reorderQty,trackBatches,isActive\nPROD-001,123456789,Sample Product,A sample description,,pcs,10.50,15.99,5,10,false,true";

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "product_import_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        const processed = validateBulkProducts(rows);

        setParsedRows(processed);
        setIsParsing(false);
      },
      error: (error) => {
        alert(`Error parsing CSV: ${error.message}`);
        setIsParsing(false);
      }
    });
  };

  const mutation = useMutation({
    mutationFn: async (validData: Partial<ProductInput>[]) => {
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to import products");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      alert(`Successfully imported ${data.created} products. ${data.errors?.length ? `Encountered ${data.errors.length} errors.` : ''}`);
      router.push("/products");
    },
    onError: (err: Error) => {
      alert(err.message);
    }
  });

  const validRows = parsedRows.filter(r => r.isValid);
  
  const handleImport = () => {
    if (validRows.length === 0) return;
    mutation.mutate(validRows.map(r => r.data));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/products")}>
            <ChevronLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Bulk Import Products</h1>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="w-4 h-4 mr-2" /> Download Template
        </Button>
      </div>

      <div className="bg-muted/30 border rounded-lg p-6 space-y-4">
        <Label htmlFor="csv-upload" className="text-lg">Upload CSV File</Label>
        <Input 
          id="csv-upload" 
          type="file" 
          accept=".csv" 
          onChange={handleFileUpload} 
          disabled={isParsing || mutation.isPending}
          className="max-w-md"
        />
        <p className="text-sm text-muted-foreground">
          Upload a CSV file containing your product catalog. The file must include a header row matching the template.
        </p>
      </div>

      {parsedRows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Preview</h2>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Total Rows: {parsedRows.length}</span>
              <span className="text-green-600 font-medium">Valid: {validRows.length}</span>
              <span className="text-red-600 font-medium">Invalid: {parsedRows.length - validRows.length}</span>
              <Button onClick={handleImport} disabled={validRows.length === 0 || mutation.isPending}>
                <Upload className="w-4 h-4 mr-2" /> 
                {mutation.isPending ? "Importing..." : `Import ${validRows.length} Valid Rows`}
              </Button>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden bg-background">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground border-b">
                  <tr>
                    <th className="p-3 font-medium">Row</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">SKU</th>
                    <th className="p-3 font-medium">Name</th>
                    <th className="p-3 font-medium">Price</th>
                    <th className="p-3 font-medium">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, idx) => (
                    <tr key={idx} className={`border-b last:border-0 ${row.isValid ? '' : 'bg-red-50/50'}`}>
                      <td className="p-3">{idx + 2}</td>
                      <td className="p-3">
                        {row.isValid ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Valid</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Invalid</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs">{row.data.sku}</td>
                      <td className="p-3">{row.data.name}</td>
                      <td className="p-3">${row.data.salePrice?.toFixed(2)}</td>
                      <td className="p-3">
                        {!row.isValid && (
                          <ul className="list-disc list-inside text-red-600 text-xs">
                            {row.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
