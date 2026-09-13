'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Download,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { Button, Badge } from '@repo/ui';
import type { ImportJobDto } from '@repo/types';
import { importsApi } from '../../lib/api/imports';

interface ImportProgressProps {
  job: ImportJobDto;
  onReset: () => void;
}

export function ImportProgress({ job, onReset }: ImportProgressProps) {
  const [isDownloading, setIsDownloading] = React.useState(false);

  const isTerminal = ['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED'].includes(job.status);
  const total = job.totalRows || 1;
  const processed = job.processedRows || 0;
  const percentage = Math.min(100, Math.round((processed / total) * 100));

  const handleDownloadErrors = async () => {
    try {
      setIsDownloading(true);
      await importsApi.downloadErrorCsv(job.id);
    } catch (err) {
      console.error('Failed to download error CSV', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const renderStatusBadge = () => {
    switch (job.status) {
      case 'COMPLETED':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1.5 px-3 py-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Completed Successfully
          </Badge>
        );
      case 'PARTIALLY_COMPLETED':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1.5 px-3 py-1">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Partially Completed
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 gap-1.5 px-3 py-1">
            <XCircle className="w-4 h-4 text-rose-600" />
            Import Failed
          </Badge>
        );
      case 'PROCESSING':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300 gap-1.5 px-3 py-1 animate-pulse">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            Processing Rows...
          </Badge>
        );
      case 'VALIDATING':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-300 gap-1.5 px-3 py-1">
            <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
            Validating Records...
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-100 text-slate-800 border-slate-300 gap-1.5 px-3 py-1">
            <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
            Queued in Background
          </Badge>
        );
    }
  };

  return (
    <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900">
              {job.type === 'PRODUCT' ? 'Product Import Job' : 'Stock Import Job'}
            </h2>
            {renderStatusBadge()}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            Job ID: {job.id} • File: {job.fileName}
          </p>
        </div>

        {isTerminal && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReset}
              className="gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Import Another File
            </Button>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-slate-700">
            {isTerminal ? 'Job execution finished' : 'Processing rows asynchronously'}
          </span>
          <span className="text-slate-900 font-mono">
            {processed} of {job.totalRows} rows ({percentage}%)
          </span>
        </div>
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              job.status === 'FAILED'
                ? 'bg-rose-500'
                : job.status === 'PARTIALLY_COMPLETED'
                  ? 'bg-amber-500'
                  : 'bg-blue-600'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-xs font-medium text-slate-500">Total Rows</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{job.totalRows}</p>
        </div>

        <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl">
          <p className="text-xs font-medium text-blue-700">Processed</p>
          <p className="text-xl font-bold text-blue-900 mt-1">{job.processedRows}</p>
        </div>

        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <p className="text-xs font-medium text-emerald-700">Successful</p>
          <p className="text-xl font-bold text-emerald-900 mt-1">{job.successfulRows}</p>
        </div>

        <div
          className={`p-3 rounded-xl border ${
            job.failedRows > 0
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <p
            className={`text-xs font-medium ${
              job.failedRows > 0 ? 'text-rose-700' : 'text-slate-500'
            }`}
          >
            Failed
          </p>
          <p className="text-xl font-bold mt-1">{job.failedRows}</p>
        </div>
      </div>

      {/* Error Action Banner */}
      {job.failedRows > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-rose-50 border border-rose-200 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-900">
                {job.failedRows} row(s) failed during import
              </p>
              <p className="text-xs text-rose-700 mt-0.5">
                Download the error report to view the exact row numbers and failure reasons.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadErrors}
            disabled={isDownloading}
            className="border-rose-300 text-rose-800 hover:bg-rose-100/70 gap-2 shrink-0 bg-white"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? 'Downloading...' : 'Download Error CSV'}
          </Button>
        </div>
      )}

      {/* Navigation After Finish */}
      {isTerminal && (
        <div className="flex items-center justify-end gap-3 pt-2">
          {job.type === 'PRODUCT' ? (
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
            >
              View Products Catalog
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              href="/stock"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
            >
              View Stock Balances
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
