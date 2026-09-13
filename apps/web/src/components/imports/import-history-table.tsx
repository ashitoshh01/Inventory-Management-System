'use client';

import * as React from 'react';
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { Button, Badge } from '@repo/ui';
import type { ImportJobDto } from '@repo/types';
import { importsApi } from '../../lib/api/imports';

interface ImportHistoryTableProps {
  jobs: ImportJobDto[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function ImportHistoryTable({ jobs, isLoading, onRefresh }: ImportHistoryTableProps) {
  const [downloadingJobId, setDownloadingJobId] = React.useState<string | null>(null);

  const handleDownloadErrors = async (jobId: string) => {
    try {
      setDownloadingJobId(jobId);
      await importsApi.downloadErrorCsv(jobId);
    } catch (err) {
      console.error('Failed to download error CSV', err);
    } finally {
      setDownloadingJobId(null);
    }
  };

  const renderStatusBadge = (status: ImportJobDto['status']) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Completed
          </Badge>
        );
      case 'PARTIALLY_COMPLETED':
        return (
          <Badge className="bg-amber-50 text-amber-800 border-amber-200 gap-1 font-medium">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Partial
          </Badge>
        );
      case 'FAILED':
        return (
          <Badge className="bg-rose-50 text-rose-700 border-rose-200 gap-1 font-medium">
            <XCircle className="w-3 h-3 text-rose-600" />
            Failed
          </Badge>
        );
      case 'PROCESSING':
        return (
          <Badge className="bg-blue-50 text-blue-700 border-blue-200 gap-1 font-medium animate-pulse">
            <Loader2 className="w-3 h-3 text-blue-600 animate-spin" />
            Processing
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-50 text-slate-700 border-slate-200 gap-1 font-medium">
            {status}
          </Badge>
        );
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Recent Import History</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="gap-2 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
            <tr>
              <th className="py-3 px-4">File Name</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Success / Total</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No previous import jobs found.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-4 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[200px]" title={job.fileName}>
                        {job.fileName}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {job.type}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">{renderStatusBadge(job.status)}</td>
                  <td className="py-3 px-4 font-mono text-slate-700">
                    <span className="text-emerald-700 font-semibold">{job.successfulRows}</span>
                    {' / '}
                    <span>{job.totalRows}</span>
                    {job.failedRows > 0 && (
                      <span className="text-rose-600 ml-1.5">({job.failedRows} failed)</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500">{formatDate(job.createdAt)}</td>
                  <td className="py-3 px-4 text-right">
                    {job.failedRows > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadErrors(job.id)}
                        disabled={downloadingJobId === job.id}
                        className="text-rose-700 hover:text-rose-800 hover:bg-rose-50 gap-1.5 text-xs h-7 px-2.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {downloadingJobId === job.id ? 'Downloading...' : 'Errors CSV'}
                      </Button>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
