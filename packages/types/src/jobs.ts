import type { ReportQueryParams } from './reports.js';

export type ExportJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ExportJobDto {
  id: string;
  organizationId: string;
  userId: string;
  reportType: string;
  status: ExportJobStatus;
  queryParams: ReportQueryParams | null;
  fileName: string | null;
  fileSize: number | null;
  rowCount: number | null;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExportJobDto {
  reportType: 'stock-movement' | 'inventory-valuation' | 'reconciliation' | 'procurement' | 'sales';
  queryParams?: ReportQueryParams;
}

export interface ExportJobResponseDto {
  exportId: string;
  status: ExportJobStatus;
  message: string;
  createdAt: string;
}

export interface LowStockCheckJobPayload {
  organizationId: string;
  productId: string;
  warehouseId: string;
  quantityAfter?: number | string | undefined;
  threshold?: number | undefined;
  referenceId?: string | undefined;
}

export interface ReportExportJobPayload {
  exportId: string;
  organizationId: string;
  userId: string;
  reportType: string;
  queryParams?: ReportQueryParams;
}

export type ImportJobType = 'PRODUCT' | 'STOCK';

export type ImportJobStatus =
  | 'PENDING'
  | 'VALIDATING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'PARTIALLY_COMPLETED';

export interface ImportRowErrorDto {
  row: number;
  column?: string | undefined;
  value?: string | number | null | undefined;
  code: string;
  message: string;
}

export interface ImportJobDto {
  id: string;
  organizationId: string;
  userId: string;
  type: ImportJobType;
  status: ImportJobStatus;
  fileName: string;
  fileSize: number;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  errors: ImportRowErrorDto[] | null;
  metadata?: Record<string, unknown> | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportPreviewRowDto {
  rowNumber: number;
  data: Record<string, string>;
  isValid: boolean;
  errors: ImportRowErrorDto[];
}

export interface ImportPreviewDto {
  type: ImportJobType;
  fileName: string;
  fileSize: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ImportRowErrorDto[];
  previewRows: ImportPreviewRowDto[];
  headers: string[];
}

export interface CreateImportJobOptions {
  mode?: 'CREATE' | 'UPSERT';
  dryRun?: boolean;
}

export interface ImportJobPayload {
  importId: string;
  organizationId: string;
  userId: string;
  type: ImportJobType;
  filePath: string;
  fileName: string;
  options?: CreateImportJobOptions;
}

