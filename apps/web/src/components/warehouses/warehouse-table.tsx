'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Warehouse as WarehouseIcon,
  MapPin,
  Star,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  AlertCircle,
  RotateCcw,
  Plus,
} from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  Skeleton,
  EmptyState,
} from '@repo/ui';
import { WarehouseStatusBadge } from './warehouse-status-badge';
import type { WarehouseDto, SortOrder } from '@repo/types';

export interface WarehouseTableProps {
  warehouses?: WarehouseDto[] | undefined;
  isLoading?: boolean | undefined;
  isError?: boolean | undefined;
  error?: Error | null | undefined;
  sortBy?: string | undefined;
  sortOrder?: SortOrder | undefined;
  onSort?: ((field: string) => void) | undefined;
  onEdit?: ((warehouse: WarehouseDto) => void) | undefined;
  onDelete?: ((warehouse: WarehouseDto) => void) | undefined;
  onCreateNew?: (() => void) | undefined;
  onRetry?: (() => void) | undefined;
  hasFilters?: boolean | undefined;
  onResetFilters?: (() => void) | undefined;
  canUpdate?: boolean | undefined;
  canDelete?: boolean | undefined;
}

export function WarehouseTable({
  warehouses = [],
  isLoading = false,
  isError = false,
  error,
  sortBy,
  sortOrder,
  onSort,
  onEdit,
  onDelete,
  onCreateNew,
  onRetry,
  hasFilters = false,
  onResetFilters,
  canUpdate = true,
  canDelete = true,
}: WarehouseTableProps) {
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

  if (isLoading && warehouses.length === 0) {
    return (
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="min-w-[220px]">Warehouse</TableHead>
                <TableHead className="w-[140px]">Facility Code</TableHead>
                <TableHead className="min-w-[180px]">Location</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[110px]">Type</TableHead>
                <TableHead className="text-right w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
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
      error?.message || 'An unexpected error occurred while fetching warehouse data.';
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
          {isPermissionError ? 'Access Denied' : 'Failed to load warehouses'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          {isPermissionError
            ? "You don't have permission to view warehouses in this organization."
            : errorMessage}
        </p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-4"
            aria-label="Retry loading warehouses"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (warehouses.length === 0) {
    if (hasFilters) {
      return (
        <EmptyState
          icon={WarehouseIcon}
          title="No matching warehouses"
          description="No warehouses match your current search and filter criteria. Try adjusting your query or resetting all filters."
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
        icon={WarehouseIcon}
        title="No warehouses yet"
        description="Your organization doesn't have any warehouses or facilities yet. Add your first warehouse to get started."
        action={
          onCreateNew && (
            <Button onClick={onCreateNew} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Warehouse
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
              {/* Warehouse Name */}
              <TableHead
                className="min-w-[220px] font-semibold whitespace-nowrap cursor-pointer select-none group"
                onClick={() => onSort?.('name')}
                onKeyDown={(e) => handleHeaderKeyDown(e, 'name')}
                tabIndex={onSort ? 0 : undefined}
                role={onSort ? 'columnheader' : undefined}
                aria-sort={getAriaSort('name')}
                aria-label={`Sort by Warehouse Name, currently ${getAriaSort('name')}`}
              >
                <div className="flex items-center">
                  <span>Warehouse</span>
                  {onSort && renderSortIndicator('name')}
                </div>
              </TableHead>

              {/* Facility Code */}
              <TableHead
                className="w-[140px] font-semibold whitespace-nowrap cursor-pointer select-none group"
                onClick={() => onSort?.('code')}
                onKeyDown={(e) => handleHeaderKeyDown(e, 'code')}
                tabIndex={onSort ? 0 : undefined}
                role={onSort ? 'columnheader' : undefined}
                aria-sort={getAriaSort('code')}
                aria-label={`Sort by Facility Code, currently ${getAriaSort('code')}`}
              >
                <div className="flex items-center">
                  <span>Code</span>
                  {onSort && renderSortIndicator('code')}
                </div>
              </TableHead>

              {/* Location (City) */}
              <TableHead
                className="min-w-[180px] font-semibold whitespace-nowrap cursor-pointer select-none group"
                onClick={() => onSort?.('city')}
                onKeyDown={(e) => handleHeaderKeyDown(e, 'city')}
                tabIndex={onSort ? 0 : undefined}
                role={onSort ? 'columnheader' : undefined}
                aria-sort={getAriaSort('city')}
                aria-label={`Sort by Location, currently ${getAriaSort('city')}`}
              >
                <div className="flex items-center">
                  <span>Location</span>
                  {onSort && renderSortIndicator('city')}
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

              {/* Type / Default */}
              <TableHead className="w-[110px] font-semibold whitespace-nowrap">Type</TableHead>

              {/* Actions */}
              <TableHead className="text-right w-[80px] font-semibold whitespace-nowrap">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehouses.map((warehouse) => {
              const locationParts = [warehouse.city, warehouse.state, warehouse.country].filter(
                Boolean,
              );
              const locationText = locationParts.length > 0 ? locationParts.join(', ') : '—';

              return (
                <TableRow
                  key={warehouse.id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => router.push(`/warehouses/${warehouse.id}`)}
                >
                  {/* Name & Description */}
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground hover:underline">
                        {warehouse.name}
                      </span>
                      {warehouse.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1 max-w-[280px] sm:max-w-md">
                          {warehouse.description}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Code */}
                  <TableCell className="font-mono text-xs font-medium text-foreground/90 whitespace-nowrap">
                    {warehouse.code}
                  </TableCell>

                  {/* Location */}
                  <TableCell>
                    <div className="flex items-center text-sm text-muted-foreground">
                      {locationParts.length > 0 && (
                        <MapPin className="mr-1.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/70" />
                      )}
                      <span className="truncate max-w-[220px]">{locationText}</span>
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell className="whitespace-nowrap">
                    <WarehouseStatusBadge status={warehouse.status} />
                  </TableCell>

                  {/* Default / Type */}
                  <TableCell className="whitespace-nowrap">
                    {warehouse.isDefault ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1"
                      >
                        <Star className="h-3 w-3 fill-current" />
                        Default
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Standard</span>
                    )}
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
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          aria-label={`Actions for warehouse ${warehouse.name} (${warehouse.code})`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[160px]">
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/warehouses/${warehouse.id}`}
                            className="flex items-center cursor-pointer"
                          >
                            <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                            View Details
                          </Link>
                        </DropdownMenuItem>

                        {canUpdate && onEdit && (
                          <DropdownMenuItem
                            onClick={() => onEdit(warehouse)}
                            className="cursor-pointer flex items-center"
                          >
                            <Edit className="mr-2 h-4 w-4 text-muted-foreground" />
                            Edit
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        {canDelete && onDelete && (
                          <DropdownMenuItem
                            onClick={() => onDelete(warehouse)}
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
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
