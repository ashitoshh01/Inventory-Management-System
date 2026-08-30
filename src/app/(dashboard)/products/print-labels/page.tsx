"use client";

import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import bwipjs from "bwip-js";

export default function PrintLabelsPage() {
  const [productIds, setProductIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Read from localStorage
    const idsString = localStorage.getItem("printLabelIds");
    if (idsString) {
      try {
        const ids = JSON.parse(idsString);
        if (Array.isArray(ids)) {
          setProductIds(ids);
        }
      } catch (e) {
        console.error("Failed to parse printLabelIds");
      }
    }
  }, []);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-for-labels", productIds],
    queryFn: async () => {
      if (productIds.length === 0) return [];
      // Fetch each product. Alternatively, create a bulk fetch endpoint.
      // We can just use Promise.all for a handful of products.
      const fetched = await Promise.all(
        productIds.map(async (id) => {
          const res = await fetch(`/api/products/${id}`);
          if (res.ok) return res.json();
          return null;
        })
      );
      return fetched.filter(Boolean);
    },
    enabled: productIds.length > 0,
  });

  useEffect(() => {
    if (products.length > 0 && !isLoading) {
      products.forEach((product) => {
        try {
          const canvas = document.getElementById(`barcode-${product.id}`) as HTMLCanvasElement;
          if (canvas) {
            bwipjs.toCanvas(canvas, {
              bcid: 'code128',
              text: product.barcode || product.sku,
              scale: 2,
              height: 10,
              includetext: false,
            });
          }
        } catch (e) {
          console.error(`Failed to generate barcode for ${product.id}`, e);
        }
      });
      
      // Wait a moment for canvases to render before printing
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [products, isLoading]);

  if (productIds.length === 0) {
    return <div className="p-8">No products selected for printing. Close this tab and try again.</div>;
  }

  if (isLoading) {
    return <div className="p-8">Loading labels...</div>;
  }

  return (
    <div className="bg-white" ref={containerRef}>
      {/* 
        Tailwind print modifiers are used here.
        Using a standard 2" x 1" layout, we can approximate it.
        At 300 DPI, 2x1 inch is ~600x300 pixels.
        We'll use CSS to force page breaks and sizing.
      */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: 2in 1in;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background-color: white;
          }
          .print-label {
            width: 2in;
            height: 1in;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 0.1in;
            box-sizing: border-box;
            overflow: hidden;
          }
          .no-print {
            display: none !important;
          }
        }
        
        /* Screen preview styling */
        @media screen {
          body {
            background-color: #f3f4f6;
            padding: 2rem;
          }
          .print-label {
            width: 2in;
            height: 1in;
            background: white;
            border: 1px solid #ccc;
            margin-bottom: 1rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 0.1in;
            box-sizing: border-box;
            overflow: hidden;
          }
        }
      `}} />

      <div className="no-print mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md text-blue-800">
        Previewing {products.length} labels. The print dialog should open automatically.
        <button onClick={() => window.print()} className="ml-4 underline font-medium">Print Again</button>
      </div>

      <div className="flex flex-col items-start gap-4">
        {products.map((product) => (
          <div key={product.id} className="print-label">
            <div className="text-[10px] font-bold text-center leading-tight truncate w-full mb-1">
              {product.name}
            </div>
            <canvas id={`barcode-${product.id}`} className="max-w-full h-auto object-contain flex-1" />
            <div className="text-[8px] font-mono text-center mt-1">
              {product.sku}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
