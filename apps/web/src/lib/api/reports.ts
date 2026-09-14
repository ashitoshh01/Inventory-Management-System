import { apiClient, getBaseUrl } from './client';
import type {
  StockMovementReportResponseDto,
  InventoryValuationReportResponseDto,
  ReconciliationReportResponseDto,
  ProcurementReportResponseDto,
  SalesReportResponseDto,
  ReportQueryParams,
} from '@repo/types';

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const reportsApi = {
  getStockMovement: (params?: ReportQueryParams) =>
    apiClient<StockMovementReportResponseDto>(
      `/reports/stock-movement${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  getInventoryValuation: (params?: ReportQueryParams) =>
    apiClient<InventoryValuationReportResponseDto>(
      `/reports/inventory-valuation${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  getReconciliation: (params?: ReportQueryParams) =>
    apiClient<ReconciliationReportResponseDto>(
      `/reports/reconciliation${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  getProcurement: (params?: ReportQueryParams) =>
    apiClient<ProcurementReportResponseDto>(
      `/reports/procurement${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  getSales: (params?: ReportQueryParams) =>
    apiClient<SalesReportResponseDto>(
      `/reports/sales${buildQueryString((params ?? {}) as Record<string, unknown>)}`,
    ),

  exportCsvUrl: (reportType: string, params?: ReportQueryParams) => {
    const qs = buildQueryString({
      reportType,
      ...(params ?? {}),
    } as Record<string, unknown>);
    return `${getBaseUrl()}/reports/export${qs}`;
  },

  downloadCsv: async (reportType: string, params?: ReportQueryParams) => {
    const qs = buildQueryString({
      reportType,
      ...(params ?? {}),
    } as Record<string, unknown>);

    const activeOrgId =
      typeof window !== 'undefined'
        ? localStorage.getItem('activeOrganizationId') || ''
        : '';

    const res = await fetch(`${getBaseUrl()}/reports/export${qs}`, {
      credentials: 'include',
      headers: {
        ...(activeOrgId ? { 'x-organization-id': activeOrgId } : {}),
      },
    });

    if (!res.ok) {
      throw new Error(`Export failed with status: ${res.status}`);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
