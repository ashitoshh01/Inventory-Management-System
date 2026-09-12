'use client';

import * as React from 'react';
import {
  Input,
  Textarea,
  Label,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui';
import { useCategories } from '../../hooks/use-categories';
import {
  UNIT_OF_MEASURE_VALUES,
  PRODUCT_STATUS_VALUES,
  type CreateProductInput,
  type UnitOfMeasure,
  type ProductStatus,
} from '@repo/types';

interface ProductFormProps {
  mode: 'create' | 'edit';
  initialValues?: {
    name?: string;
    sku?: string;
    categoryId?: string;
    description?: string | null;
    unitOfMeasure?: UnitOfMeasure;
    status?: ProductStatus;
  };
  onSubmit: (data: CreateProductInput) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ProductForm({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ProductFormProps) {
  const { data: categoriesData, isLoading: isLoadingCategories } = useCategories();
  const categories = categoriesData?.data ?? [];

  const [name, setName] = React.useState(initialValues?.name ?? '');
  const [sku, setSku] = React.useState(initialValues?.sku ?? '');
  const [categoryId, setCategoryId] = React.useState(initialValues?.categoryId ?? '');
  const [description, setDescription] = React.useState(initialValues?.description ?? '');
  const [unitOfMeasure, setUnitOfMeasure] = React.useState<UnitOfMeasure>(
    initialValues?.unitOfMeasure ?? 'UNIT',
  );
  const [status, setStatus] = React.useState<ProductStatus>(initialValues?.status ?? 'ACTIVE');

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!name.trim()) {
      nextErrors.name = 'Product name is required';
    } else if (name.trim().length > 100) {
      nextErrors.name = 'Product name must be at most 100 characters';
    }

    if (!sku.trim()) {
      nextErrors.sku = 'SKU is required';
    } else if (sku.trim().length > 50) {
      nextErrors.sku = 'SKU must be at most 50 characters';
    } else if (!/^[A-Za-z0-9._-]+$/.test(sku.trim())) {
      nextErrors.sku =
        'SKU can only contain alphanumeric characters, hyphens, underscores, and dots';
    }

    if (!categoryId) {
      nextErrors.categoryId = 'Category is required';
    }

    if (description && description.length > 1000) {
      nextErrors.description = 'Description must be at most 1000 characters';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      categoryId,
      description: description.trim() || null,
      unitOfMeasure,
      status,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Product Name */}
      <div className="space-y-1.5">
        <Label htmlFor="product-name" className="text-sm font-medium">
          Product Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="product-name"
          placeholder="e.g. Wireless Ergonomic Mouse"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
          }}
          className={errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
          disabled={isSubmitting}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      {/* SKU */}
      <div className="space-y-1.5">
        <Label htmlFor="product-sku" className="text-sm font-medium">
          SKU (Stock Keeping Unit) <span className="text-destructive">*</span>
        </Label>
        <Input
          id="product-sku"
          placeholder="e.g. MOUSE-WL-001"
          value={sku}
          onChange={(e) => {
            setSku(e.target.value.toUpperCase());
            if (errors.sku) setErrors((prev) => ({ ...prev, sku: '' }));
          }}
          className={`font-mono ${errors.sku ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          disabled={isSubmitting}
        />
        {errors.sku && <p className="text-xs text-destructive">{errors.sku}</p>}
      </div>

      {/* Category Selection */}
      <div className="space-y-1.5">
        <Label htmlFor="product-category" className="text-sm font-medium">
          Category <span className="text-destructive">*</span>
        </Label>
        <Select
          value={categoryId}
          onValueChange={(val) => {
            setCategoryId(val);
            if (errors.categoryId) setErrors((prev) => ({ ...prev, categoryId: '' }));
          }}
          disabled={isSubmitting || isLoadingCategories}
        >
          <SelectTrigger
            id="product-category"
            className={errors.categoryId ? 'border-destructive focus:ring-destructive' : ''}
          >
            <SelectValue
              placeholder={isLoadingCategories ? 'Loading categories...' : 'Select a category'}
            />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId}</p>}
      </div>

      {/* Unit of Measure and Status (side-by-side) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="product-uom" className="text-sm font-medium">
            Unit of Measure
          </Label>
          <Select
            value={unitOfMeasure}
            onValueChange={(val) => setUnitOfMeasure(val as UnitOfMeasure)}
            disabled={isSubmitting}
          >
            <SelectTrigger id="product-uom">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OF_MEASURE_VALUES.map((uom) => (
                <SelectItem key={uom} value={uom}>
                  {uom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="product-status" className="text-sm font-medium">
            Status
          </Label>
          <Select
            value={status}
            onValueChange={(val) => setStatus(val as ProductStatus)}
            disabled={isSubmitting}
          >
            <SelectTrigger id="product-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_STATUS_VALUES.map((st) => (
                <SelectItem key={st} value={st}>
                  {st === 'ACTIVE' ? 'Active' : 'Inactive'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="product-description" className="text-sm font-medium">
          Description <span className="text-muted-foreground font-normal">(Optional)</span>
        </Label>
        <Textarea
          id="product-description"
          placeholder="Detailed product specifications or notes..."
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
          }}
          className={errors.description ? 'border-destructive focus-visible:ring-destructive' : ''}
          rows={3}
          disabled={isSubmitting}
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
      </div>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? mode === 'create'
              ? 'Creating...'
              : 'Saving...'
            : mode === 'create'
              ? 'Create Product'
              : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
