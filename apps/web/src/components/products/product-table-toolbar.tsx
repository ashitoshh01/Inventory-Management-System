'use client';

import * as React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import {
  Input,
  Button,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui';
import { useCategories } from '../../hooks/use-categories';
import { UNIT_OF_MEASURE_VALUES, type ProductStatus, type UnitOfMeasure } from '@repo/types';

interface ProductTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  categoryId?: string | undefined;
  onCategoryChange: (value?: string) => void;
  status?: ProductStatus | undefined;
  onStatusChange: (value?: ProductStatus) => void;
  unitOfMeasure?: UnitOfMeasure | undefined;
  onUnitOfMeasureChange: (value?: UnitOfMeasure) => void;
  onReset: () => void;
}

export function ProductTableToolbar({
  search,
  onSearchChange,
  categoryId,
  onCategoryChange,
  status,
  onStatusChange,
  unitOfMeasure,
  onUnitOfMeasureChange,
  onReset,
}: ProductTableToolbarProps) {
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.data ?? [];

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const hasFilters = Boolean(search || categoryId || status || unitOfMeasure);
  const activeFilterCount = (categoryId ? 1 : 0) + (status ? 1 : 0) + (unitOfMeasure ? 1 : 0);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && search) {
      onSearchChange('');
    }
  };

  return (
    <div className="space-y-2 py-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search input */}
          <div className="relative w-full max-w-xs">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <Input
              aria-label="Search products by name or SKU"
              placeholder="Search by name, SKU..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 pr-8 h-9 text-sm"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search query"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="w-[160px]">
            <Select
              value={categoryId || 'ALL'}
              onValueChange={(val) => onCategoryChange(val === 'ALL' ? undefined : val)}
            >
              <SelectTrigger
                aria-label="Filter by category"
                className={`h-9 text-sm ${categoryId ? 'border-primary text-foreground font-medium' : ''}`}
              >
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-[130px]">
            <Select
              value={status || 'ALL'}
              onValueChange={(val) =>
                onStatusChange(val === 'ALL' ? undefined : (val as ProductStatus))
              }
            >
              <SelectTrigger
                aria-label="Filter by status"
                className={`h-9 text-sm ${status ? 'border-primary text-foreground font-medium' : ''}`}
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Unit of Measure Filter */}
          <div className="w-[140px]">
            <Select
              value={unitOfMeasure || 'ALL'}
              onValueChange={(val) =>
                onUnitOfMeasureChange(val === 'ALL' ? undefined : (val as UnitOfMeasure))
              }
            >
              <SelectTrigger
                aria-label="Filter by unit of measure"
                className={`h-9 text-sm ${unitOfMeasure ? 'border-primary text-foreground font-medium' : ''}`}
              >
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Units</SelectItem>
                {UNIT_OF_MEASURE_VALUES.map((uom) => (
                  <SelectItem key={uom} value={uom}>
                    {uom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reset button */}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              aria-label="Reset all filters and search"
              className="h-9 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Active filter badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-muted-foreground">
          <span className="font-medium">Active filters:</span>
          {selectedCategory && (
            <Badge
              variant="secondary"
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs font-normal bg-muted text-foreground border border-border"
            >
              <span>Category: {selectedCategory.name}</span>
              <button
                type="button"
                aria-label={`Remove category filter ${selectedCategory.name}`}
                onClick={() => onCategoryChange(undefined)}
                className="hover:text-destructive focus-visible:outline-none rounded-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {status && (
            <Badge
              variant="secondary"
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs font-normal bg-muted text-foreground border border-border"
            >
              <span>Status: {status === 'ACTIVE' ? 'Active' : 'Inactive'}</span>
              <button
                type="button"
                aria-label={`Remove status filter ${status}`}
                onClick={() => onStatusChange(undefined)}
                className="hover:text-destructive focus-visible:outline-none rounded-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {unitOfMeasure && (
            <Badge
              variant="secondary"
              className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 text-xs font-normal bg-muted text-foreground border border-border"
            >
              <span>Unit: {unitOfMeasure}</span>
              <button
                type="button"
                aria-label={`Remove unit of measure filter ${unitOfMeasure}`}
                onClick={() => onUnitOfMeasureChange(undefined)}
                className="hover:text-destructive focus-visible:outline-none rounded-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
