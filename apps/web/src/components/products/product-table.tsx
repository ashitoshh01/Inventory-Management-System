'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  PackagePlus,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RotateCcw,
} from 'lucide-react';
import type { ProductDto, SortOrder } from '@repo/types';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  Skeleton,
  EmptyState,
} from '@repo/ui';

interface ProductTableProps {
  products?: ProductDto[];
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  sortBy?: string | undefined;
  sortOrder?: SortOrder | undefined;
  onSort?: ((field: string) => void) | undefined;
  onEdit?: ((product: ProductDto) => void) | undefined;
  onDelete?: ((product: ProductDto) => void) | undefined;
  onAddNew?: (() => void) | undefined;
  onRetry?: (() => void) | undefined;
  hasFilters?: boolean | undefined;
  onResetFilters?: (() => void) | undefined;
}

export function ProductTable({
  products = [],
  isLoading,
  isError,
  error,
  sortBy,
  sortOrder,
  onSort,
  onEdit,
  onDelete,
  onAddNew,
  onRetry,
  hasFilters = false,
  onResetFilters,
}: ProductTableProps) {
  const router = useRouter();

  const renderSortIndicator = (field: string) => {
    if (sortBy === field) {
      return sortOrder === 'asc' ? (
        <ArrowUp className="ml-1.5 h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
      ) : (
        <ArrowDown className="ml-1.5 h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
      );
    }
    return (
      <ArrowUpDown
        className="ml-1.5 h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0"
        aria-hidden="true"
      />
    );
  };

  const getAriaSort = (field: string): 'ascending' | 'descending' | 'none' => {
    if (sortBy === field) {
      return sortOrder === 'asc' ? 'ascending' : 'descending';
    }
    return 'none';
  };

  const handleHeaderKeyDown = (e: React.KeyboardEvent, field: string) => {
    if (onSort && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onSort(field);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[140px] whitespace-nowrap">SKU</TableHead>
                <TableHead className="whitespace-nowrap">Product</TableHead>
                <TableHead className="w-[160px] whitespace-nowrap">Category</TableHead>
                <TableHead className="w-[100px] whitespace-nowrap">Unit</TableHead>
                <TableHead className="w-[110px] whitespace-nowrap">Status</TableHead>
                <TableHead className="w-[130px] whitespace-nowrap">Created</TableHead>
                <TableHead className="w-[70px] text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-8 ml-auto rounded-md" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (isError) {
    const errorMessage =
      error?.message || 'An unexpected error occurred while fetching product data.';
    const isPermissionError =
      errorMessage.toLowerCase().includes('permission') || errorMessage.includes('403');

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex flex-col items-center justify-center p-8 border rounded-md border-destructive/20 bg-destructive/5 text-center"
      >
        <AlertCircle className="h-10 w-10 text-destructive mb-3" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-foreground">
          {isPermissionError ? 'Access Denied' : 'Failed to load products'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          {isPermissionError
            ? "You don't have permission to view products in this organization."
            : errorMessage}
        </p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-4"
            aria-label="Retry loading products"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (products.length === 0) {
    if (hasFilters) {
      return (
        <EmptyState
          icon={PackagePlus}
          title="No matching products"
          description="No products match your current search and filter criteria. Try adjusting your query or resetting all filters."
          action={
            onResetFilters && (
              <Button onClick={onResetFilters} size="sm" variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset Filters
              </Button>
            )
          }
        />
      );
    }

    return (
      <EmptyState
        icon={PackagePlus}
        title="No products yet"
        description="Your organization doesn't have any products in the catalog yet. Add your first product to get started."
        action={
          onAddNew && (
            <Button onClick={onAddNew} size="sm">
              <PackagePlus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          )
        }
      />
    );
  }

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {/* SKU */}
              <TableHead
                className="w-[140px] font-semibold whitespace-nowrap cursor-pointer select-none group"
                onClick={() => onSort?.('sku')}
                onKeyDown={(e) => handleHeaderKeyDown(e, 'sku')}
                tabIndex={onSort ? 0 : undefined}
                role={onSort ? 'columnheader' : undefined}
                aria-sort={getAriaSort('sku')}
                aria-label={`Sort by SKU, currently ${getAriaSort('sku')}`}
              >
                <div className="flex items-center">
                  <span>SKU</span>
                  {onSort && renderSortIndicator('sku')}
                </div>
              </TableHead>

              {/* Product */}
              <TableHead
                className="font-semibold whitespace-nowrap cursor-pointer select-none group min-w-[200px]"
                onClick={() => onSort?.('name')}
                onKeyDown={(e) => handleHeaderKeyDown(e, 'name')}
                tabIndex={onSort ? 0 : undefined}
                role={onSort ? 'columnheader' : undefined}
                aria-sort={getAriaSort('name')}
                aria-label={`Sort by Product Name, currently ${getAriaSort('name')}`}
              >
                <div className="flex items-center">
                  <span>Product</span>
                  {onSort && renderSortIndicator('name')}
                </div>
              </TableHead>

              {/* Category */}
              <TableHead className="w-[160px] font-semibold whitespace-nowrap">Category</TableHead>

              {/* Unit */}
              <TableHead
                className="w-[100px] font-semibold whitespace-nowrap cursor-pointer select-none group"
                onClick={() => onSort?.('unitOfMeasure')}
                onKeyDown={(e) => handleHeaderKeyDown(e, 'unitOfMeasure')}
                tabIndex={onSort ? 0 : undefined}
                role={onSort ? 'columnheader' : undefined}
                aria-sort={getAriaSort('unitOfMeasure')}
                aria-label={`Sort by Unit of Measure, currently ${getAriaSort('unitOfMeasure')}`}
              >
                <div className="flex items-center">
                  <span>Unit</span>
                  {onSort && renderSortIndicator('unitOfMeasure')}
                </div>
              </TableHead>

              {/* Status */}
              <TableHead
                className="w-[110px] font-semibold whitespace-nowrap cursor-pointer select-none group"
                onClick={() => onSort?.('status')}
                onKeyDown={(e) => handleHeaderKeyDown(e, 'status')}
                tabIndex={onSort ? 0 : undefined}
                role={onSort ? 'columnheader' : undefined}
                aria-sort={getAriaSort('status')}
                aria-label={`Sort by Status, currently ${getAriaSort('status')}`}
              >
                <div className="flex items-center">
                  <span>Status</span>
                  {onSort && renderSortIndicator('status')}
                </div>
              </TableHead>

              {/* Created */}
              <TableHead
                className="w-[130px] font-semibold whitespace-nowrap cursor-pointer select-none group"
                onClick={() => onSort?.('createdAt')}
                onKeyDown={(e) => handleHeaderKeyDown(e, 'createdAt')}
                tabIndex={onSort ? 0 : undefined}
                role={onSort ? 'columnheader' : undefined}
                aria-sort={getAriaSort('createdAt')}
                aria-label={`Sort by Creation Date, currently ${getAriaSort('createdAt')}`}
              >
                <div className="flex items-center">
                  <span>Created</span>
                  {onSort && renderSortIndicator('createdAt')}
                </div>
              </TableHead>

              {/* Actions */}
              <TableHead className="w-[70px] text-right font-semibold whitespace-nowrap">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow
                key={product.id}
                className="cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => router.push(`/products/${product.id}`)}
              >
                {/* SKU */}
                <TableCell className="font-mono text-xs font-medium text-foreground/90 whitespace-nowrap">
                  {product.sku}
                </TableCell>

                {/* Name & Description */}
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground hover:underline">
                      {product.name}
                    </span>
                    {product.description && (
                      <span className="text-xs text-muted-foreground line-clamp-1 max-w-[280px] sm:max-w-md">
                        {product.description}
                      </span>
                    )}
                  </div>
                </TableCell>

                {/* Category */}
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {product.category?.name ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                      {product.category.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </TableCell>

                {/* Unit of measure */}
                <TableCell className="text-sm text-foreground/80 font-medium whitespace-nowrap">
                  {product.unitOfMeasure}
                </TableCell>

                {/* Status */}
                <TableCell className="whitespace-nowrap">
                  {product.status === 'ACTIVE' ? (
                    <Badge
                      variant="default"
                      className="bg-emerald-600 hover:bg-emerald-600/90 text-white font-medium text-[11px] px-2"
                    >
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-medium text-[11px] px-2">
                      Inactive
                    </Badge>
                  )}
                </TableCell>

                {/* Created At */}
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(product.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </TableCell>

                {/* Actions */}
                <TableCell
                  className="text-right whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        aria-label={`Actions for product ${product.name} (${product.sku})`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px]">
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/products/${product.id}`}
                          className="cursor-pointer flex items-center"
                        >
                          <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      {onEdit && (
                        <DropdownMenuItem
                          onClick={() => onEdit(product)}
                          className="cursor-pointer flex items-center"
                        >
                          <Edit className="mr-2 h-4 w-4 text-muted-foreground" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {onDelete && (
                        <DropdownMenuItem
                          onClick={() => onDelete(product)}
                          className="cursor-pointer text-destructive focus:text-destructive flex items-center"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
