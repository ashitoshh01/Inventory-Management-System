'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  Play,
  History,
  Info,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';
import { Button, Badge } from '@repo/ui';
import type { ImportJobType, ImportPreviewDto, ImportJobDto } from '@repo/types';

import { usePermissions } from '../../hooks/use-permissions';
import { importsApi } from '../../lib/api/imports';
import { ImportDropzone } from '../../components/imports/import-dropzone';
import { ImportPreviewTable } from '../../components/imports/import-preview-table';
import { ImportProgress } from '../../components/imports/import-progress';
import { ImportHistoryTable } from '../../components/imports/import-history-table';

export default function ImportsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { canCreateProduct, canMutateStock } = usePermissions();

  const initialType = (searchParams?.get('type') as ImportJobType) || 'PRODUCT';
  const [importType, setImportType] = React.useState<ImportJobType>(
    initialType === 'STOCK' ? 'STOCK' : 'PRODUCT',
  );
  const [productMode, setProductMode] = React.useState<'CREATE' | 'UPSERT'>('CREATE');

  // File and preview states
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<ImportPreviewDto | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  // Execution states
  const [activeJob, setActiveJob] = React.useState<ImportJobDto | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // History states
  const [jobs, setJobs] = React.useState<ImportJobDto[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false);

  // Fetch past jobs on mount
  const fetchJobs = React.useCallback(async () => {
    try {
      setIsHistoryLoading(true);
      const res = await importsApi.listImportJobs({ limit: 20 });
      setJobs(res.data || []);
    } catch (err) {
      console.error('Failed to load import jobs history', err);
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Sync URL query when type changes
  const handleTypeChange = (type: ImportJobType) => {
    setImportType(type);
    setSelectedFile(null);
    setPreview(null);
    setPreviewError(null);
    setActiveJob(null);
    router.replace(`/imports?type=${type}`);
  };

  // Trigger preview dry-run when file is selected
  const handleFileSelect = async (file: File | null) => {
    setSelectedFile(file);
    setPreview(null);
    setPreviewError(null);
    setActiveJob(null);

    if (!file) return;

    try {
      setIsPreviewLoading(true);
      const res = await importsApi.previewImport(file, importType, productMode);
      setPreview(res.data);
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to generate preview for the uploaded file.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Re-run preview if productMode changes while a file is selected
  React.useEffect(() => {
    if (selectedFile && importType === 'PRODUCT') {
      handleFileSelect(selectedFile);
    }
  }, [productMode]);

  // Trigger job execution
  const handleStartImport = async () => {
    if (!selectedFile) return;

    try {
      setIsSubmitting(true);
      const res = await importsApi.createImportJob(selectedFile, importType, productMode);
      setActiveJob(res.data);
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to enqueue import job.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Polling active job until terminal state
  React.useEffect(() => {
    if (!activeJob) return;

    const terminalStatuses = ['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED'];
    if (terminalStatuses.includes(activeJob.status)) {
      fetchJobs();
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await importsApi.getImportJob(activeJob.id);
        setActiveJob(res.data);
        if (terminalStatuses.includes(res.data.status)) {
          clearInterval(interval);
          fetchJobs();
        }
      } catch (err) {
        console.error('Failed to poll job status', err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeJob?.id, activeJob?.status, fetchJobs]);

  const handleReset = () => {
    setSelectedFile(null);
    setPreview(null);
    setPreviewError(null);
    setActiveJob(null);
  };

  // Permission checks
  const hasPermission =
    importType === 'PRODUCT' ? canCreateProduct : canMutateStock;

  return (
    <div className="space-y-8 pb-12 max-w-7xl mx-auto">
      {/* 1. Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Import & Bulk Operations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Bulk create or update catalog products and initialize stock balances using RFC 4180 CSV files.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => importsApi.downloadTemplate(importType)}
            className="gap-2 text-xs font-semibold"
          >
            <Download className="w-4 h-4" />
            Download {importType === 'PRODUCT' ? 'Product' : 'Stock'} CSV Template
          </Button>
        </div>
      </div>

      {/* 2. Type Selector Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => handleTypeChange('PRODUCT')}
          className={`flex items-center gap-2 py-3 px-6 text-sm font-semibold border-b-2 transition-colors ${
            importType === 'PRODUCT'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Product Catalog Import
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange('STOCK')}
          className={`flex items-center gap-2 py-3 px-6 text-sm font-semibold border-b-2 transition-colors ${
            importType === 'STOCK'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          Stock & Balance Mutation Import
        </button>
      </div>

      {/* Permission Warning */}
      {!hasPermission && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-semibold">Access restricted:</span> You do not have permission to{' '}
            {importType === 'PRODUCT' ? 'create products' : 'mutate inventory stock'}. You can inspect templates, but import execution will be rejected.
          </div>
        </div>
      )}

      {/* 3. Active Job in Progress or Completion */}
      {activeJob ? (
        <ImportProgress job={activeJob} onReset={handleReset} />
      ) : (
        /* 4. Import Workflow Container */
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-6">
          {/* Mode toggle for Products */}
          {importType === 'PRODUCT' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                    Import Mode
                  </p>
                  <p className="text-xs text-slate-500">
                    Choose how existing product SKUs should be handled.
                  </p>
                </div>
                <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setProductMode('CREATE')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      productMode === 'CREATE'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    CREATE (Strict New)
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductMode('UPSERT')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      productMode === 'UPSERT'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    UPSERT (Create or Update)
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                {productMode === 'CREATE'
                  ? 'CREATE mode strictly creates new products. Any existing SKU will fail validation.'
                  : 'UPSERT mode creates new products and updates name, cost, and price for existing SKUs.'}
              </p>
            </div>
          )}

          {/* Stock Domain Notice */}
          {importType === 'STOCK' && (
            <div className="flex items-start gap-3 p-4 bg-blue-50/50 border border-blue-200 rounded-xl text-xs text-blue-900">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Authoritative Stock Mutation Guarantee:</p>
                <p className="mt-0.5 text-blue-800">
                  Stock imports mutate inventory balances strictly via the system&apos;s authoritative{' '}
                  <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">StockMutationService</code>.
                  Each row produces an immutable, audited <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">StockLedgerEntry</code> and updates the warehouse <code className="bg-blue-100 px-1 py-0.5 rounded font-mono text-[11px]">StockBalance</code> with full idempotency protection.
                </p>
              </div>
            </div>
          )}

          {/* Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Select CSV File
            </label>
            <ImportDropzone
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              disabled={isPreviewLoading || isSubmitting || !hasPermission}
            />
          </div>

          {/* Loading preview state */}
          {isPreviewLoading && (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="inline-block animate-spin text-blue-600">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                Analyzing CSV and validating rows...
              </p>
              <p className="text-xs text-slate-500">
                Checking schema, tenant warehouse ownership, and duplicate SKUs in dry-run mode.
              </p>
            </div>
          )}

          {/* Preview Error */}
          {previewError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
              <p className="font-semibold">Import Error:</p>
              <p>{previewError}</p>
            </div>
          )}

          {/* Preview Results Table */}
          {preview && !isPreviewLoading && (
            <div className="space-y-6 pt-4 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Validation Dry-Run Preview
                  </h3>
                  <p className="text-xs text-slate-500">
                    Inspect parsed rows and review errors before committing to the database.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={handleStartImport}
                  disabled={preview.validRows === 0 || isSubmitting || !hasPermission}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold shadow-sm"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {isSubmitting
                    ? 'Queueing Job...'
                    : `Start Import (${preview.validRows.toLocaleString()} valid rows)`}
                </Button>
              </div>

              <ImportPreviewTable preview={preview} type={importType} />
            </div>
          )}
        </div>
      )}

      {/* 5. Previous Imports History Section */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-slate-500" />
          <h2 className="text-base font-bold text-slate-900">Import History & Audit Log</h2>
        </div>
        <p className="text-xs text-slate-500">
          Historical record of all asynchronous bulk import operations processed for this organization.
        </p>
        <ImportHistoryTable
          jobs={jobs}
          isLoading={isHistoryLoading}
          onRefresh={fetchJobs}
        />
      </div>
    </div>
  );
}
