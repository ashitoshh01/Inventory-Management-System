'use client';

import * as React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Filter } from 'lucide-react';
import { Badge, Button } from '@repo/ui';
import type { ImportPreviewDto, ImportJobType, ImportPreviewRowDto, ImportRowErrorDto } from '@repo/types';

interface ImportPreviewTableProps {
  preview: ImportPreviewDto;
  type: ImportJobType;
}

export function ImportPreviewTable({ preview, type }: ImportPreviewTableProps) {
  const [filterMode, setFilterMode] = React.useState<'ALL' | 'VALID' | 'INVALID'>('ALL');
  const [page, setPage] = React.useState(1);
  const pageSize = 10;

  const rows = preview.previewRows || [];

  const filteredRows = React.useMemo(() => {
    if (filterMode === 'VALID') return rows.filter((r: ImportPreviewRowDto) => r.isValid);
    if (filterMode === 'INVALID') return rows.filter((r: ImportPreviewRowDto) => !r.isValid);
    return rows;
  }, [rows, filterMode]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  // Reset page when filter changes
  React.useEffect(() => {
    setPage(1);
  }, [filterMode]);

  return (
    <div className="space-y-4">
      {/* 1. Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Rows
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {preview.totalRows.toLocaleString()}
          </p>
        </div>

        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Valid Rows
            </p>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-900 mt-1">
            {preview.validRows.toLocaleString()}
          </p>
        </div>

        <div
          className={`p-4 rounded-xl border ${
            preview.invalidRows > 0
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <p
              className={`text-xs font-semibold uppercase tracking-wider ${
                preview.invalidRows > 0 ? 'text-rose-700' : 'text-slate-500'
              }`}
            >
              Invalid Rows
            </p>
            {preview.invalidRows > 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-slate-400" />
            )}
          </div>
          <p
            className={`text-2xl font-bold mt-1 ${
              preview.invalidRows > 0 ? 'text-rose-900' : 'text-slate-700'
            }`}
          >
            {preview.invalidRows.toLocaleString()}
          </p>
        </div>
      </div>

      {preview.invalidRows > 0 && (
        <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Validation warning:</span>{' '}
            {preview.invalidRows} row(s) contain validation errors. If you proceed, only valid rows will be imported and failed rows will be logged to an error report.
          </div>
        </div>
      )}

      {/* 2. Filters & View Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Filter Preview:</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterMode === 'ALL'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({preview.totalRows})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('VALID')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterMode === 'VALID'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Valid ({preview.validRows})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('INVALID')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                filterMode === 'INVALID'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Invalid ({preview.invalidRows})
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Showing {paginatedRows.length} of {filteredRows.length} rows
        </div>
      </div>

      {/* 3. Preview Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
            <tr>
              <th className="py-3 px-4 w-16">Status</th>
              <th className="py-3 px-4 w-16">Row #</th>
              <th className="py-3 px-4">SKU</th>
              {type === 'PRODUCT' ? (
                <>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Unit Cost</th>
                  <th className="py-3 px-4">Unit Price</th>
                  <th className="py-3 px-4">Reorder</th>
                </>
              ) : (
                <>
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-4">Delta</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Reason</th>
                </>
              )}
              <th className="py-3 px-4">Errors / Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={type === 'PRODUCT' ? 9 : 8}
                  className="py-8 text-center text-slate-400"
                >
                  No rows match the selected filter.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row: ImportPreviewRowDto) => (
                <tr
                  key={row.rowNumber}
                  className={!row.isValid ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/60'}
                >
                  <td className="py-3 px-4">
                    {row.isValid ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Valid
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 gap-1 font-medium">
                        <XCircle className="w-3 h-3 text-rose-600" />
                        Invalid
                      </Badge>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500">{row.rowNumber}</td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-800">
                    {row.data['sku'] || row.data['SKU'] || '—'}
                  </td>
                  {type === 'PRODUCT' ? (
                    <>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {row.data['name'] || row.data['Name'] || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {row.data['category'] || row.data['Category'] || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {row.data['unitCost'] || row.data['Unit Cost'] || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {row.data['unitPrice'] || row.data['Unit Price'] || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {row.data['reorderPoint'] || row.data['Reorder Point'] || '—'}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {row.data['warehouseCode'] || row.data['Warehouse Code'] || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">
                        {row.data['quantityDelta'] || row.data['Quantity Delta'] || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {row.data['type'] || row.data['Type'] || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {row.data['reason'] || row.data['Reason'] || '—'}
                      </td>
                    </>
                  )}
                  <td className="py-3 px-4">
                    {row.errors && row.errors.length > 0 ? (
                      <div className="space-y-1">
                        {row.errors.map((err: ImportRowErrorDto, idx: number) => (
                          <div
                            key={idx}
                            className="text-xs text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded"
                          >
                            <span className="font-semibold">{err.column}:</span> {err.message}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Ready to import</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-xs text-slate-600">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
