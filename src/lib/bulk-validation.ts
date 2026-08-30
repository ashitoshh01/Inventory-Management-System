import { productSchema, ProductInput } from './validators/product.schema';

export type ParsedRow = {
  original: any;
  data: Partial<ProductInput>;
  isValid: boolean;
  errors: string[];
};

export function validateBulkProducts(rows: any[]): ParsedRow[] {
  const seenSkus = new Set<string>();

  return rows.map((row) => {
    // Transform strings to appropriate types
    const transformed = {
      sku: row.sku || "",
      barcode: row.barcode || undefined,
      name: row.name || "",
      description: row.description || undefined,
      categoryId: row.categoryId || undefined,
      unit: row.unit || "pcs",
      costPrice: parseFloat(row.costPrice) || 0,
      salePrice: parseFloat(row.salePrice) || 0,
      reorderPoint: parseInt(row.reorderPoint) || 0,
      reorderQty: parseInt(row.reorderQty) || 0,
      trackBatches: String(row.trackBatches).toLowerCase() === "true",
      isActive: row.isActive === undefined ? true : String(row.isActive).toLowerCase() !== "false",
      images: [],
      variants: [],
      isBundle: false,
      bundleItems: []
    };

    const validation = productSchema.safeParse(transformed);
    let isValid = validation.success;
    const errors = validation.success ? [] : validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);

    // Duplicate SKU check
    if (isValid && transformed.sku) {
      if (seenSkus.has(transformed.sku)) {
        isValid = false;
        errors.push(`sku: Duplicate SKU within the import file`);
      } else {
        seenSkus.add(transformed.sku);
      }
    }

    return {
      original: row,
      data: transformed as Partial<ProductInput>,
      isValid,
      errors
    };
  });
}
