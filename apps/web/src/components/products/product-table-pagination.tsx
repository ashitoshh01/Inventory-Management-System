'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui';

interface ProductTablePaginationProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export function ProductTablePagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange,
}: ProductTablePaginationProps) {
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);
  const normalizedTotalPages = Math.max(1, totalPages);

  // Generate visible page numbers for pagination
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (normalizedTotalPages <= 5) {
      return Array.from({ length: normalizedTotalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [1];

    if (page > 3) {
      pages.push('ellipsis');
    }

    const start = Math.max(2, page - 1);
    const end = Math.min(normalizedTotalPages - 1, page + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page < normalizedTotalPages - 2) {
      pages.push('ellipsis');
    }

    if (normalizedTotalPages > 1) {
      pages.push(normalizedTotalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col items-center justify-between gap-4 px-2 py-4 sm:flex-row border-t border-border">
      {/* Result range counter */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          Showing <span className="font-medium text-foreground">{startItem}</span>–
          <span className="font-medium text-foreground">{endItem}</span> of{' '}
          <span className="font-medium text-foreground">{total}</span> results
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground hidden sm:inline">Rows per page:</span>
          <div className="w-[72px]">
            <Select value={String(limit)} onValueChange={(val) => onLimitChange(Number(val))}>
              <SelectTrigger className="h-8 text-xs" aria-label="Rows per page">
                <SelectValue placeholder={String(limit)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Page navigation controls */}
        <div className="flex items-center gap-1">
          {/* Previous Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>

          {/* Direct Page Numbers */}
          <div className="hidden sm:flex items-center gap-1">
            {pageNumbers.map((p, idx) => {
              if (p === 'ellipsis') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 text-xs text-muted-foreground select-none"
                    aria-hidden="true"
                  >
                    …
                  </span>
                );
              }
              const isCurrent = p === page;
              return (
                <Button
                  key={p}
                  variant={isCurrent ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 min-w-[32px] px-2 text-xs"
                  onClick={() => onPageChange(p)}
                  aria-label={`Page ${p}`}
                  aria-current={isCurrent ? 'page' : undefined}
                >
                  {p}
                </Button>
              );
            })}
          </div>

          {/* Compact page display on mobile screens */}
          <span className="sm:hidden px-2 text-xs text-muted-foreground">
            {page} / {normalizedTotalPages}
          </span>

          {/* Next Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= normalizedTotalPages || total === 0}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
