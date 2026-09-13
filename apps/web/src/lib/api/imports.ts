import { apiClient } from './client';
import type { ImportJobDto, ImportPreviewDto, ImportJobType } from '@repo/types';

export interface ListImportJobsParams {
  page?: number;
  limit?: number;
  type?: ImportJobType;
}

export const importsApi = {
  previewImport: async (file: File, type: ImportJobType, mode: 'CREATE' | 'UPSERT' = 'CREATE') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    if (type === 'PRODUCT') {
      formData.append('mode', mode);
    }

    return apiClient<ImportPreviewDto>('/imports/preview', {
      method: 'POST',
      body: formData,
    });
  },

  createImportJob: async (file: File, type: ImportJobType, mode: 'CREATE' | 'UPSERT' = 'CREATE') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    if (type === 'PRODUCT') {
      formData.append('mode', mode);
    }

    return apiClient<ImportJobDto>('/imports', {
      method: 'POST',
      body: formData,
    });
  },

  getImportJob: async (id: string) => {
    return apiClient<ImportJobDto>(`/imports/${id}`);
  },

  listImportJobs: async (params?: ListImportJobsParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.type) searchParams.set('type', params.type);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';

    return apiClient<ImportJobDto[]>(`/imports${qs}`);
  },

  downloadErrorCsv: async (jobId: string) => {
    const activeOrgId =
      typeof window !== 'undefined'
        ? localStorage.getItem('activeOrganizationId') || ''
        : '';

    const res = await fetch(`/api/v1/imports/${jobId}/errors`, {
      headers: {
        ...(activeOrgId ? { 'x-organization-id': activeOrgId } : {}),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to download error CSV (${res.status})`);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${jobId}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  downloadTemplate: (type: ImportJobType) => {
    let content = '';
    let filename = '';

    if (type === 'PRODUCT') {
      content =
        'SKU,Name,Category,Unit Cost,Unit Price,Reorder Point\n' +
        'PROD-001,Premium Steel Widget,Hardware,19.99,39.99,10\n' +
        'PROD-002,Aluminum Flange,Hardware,8.50,15.00,25\n';
      filename = 'products_import_template.csv';
    } else {
      content =
        'SKU,Warehouse Code,Quantity Delta,Type,Reason\n' +
        'PROD-001,WH-MAIN,50.0000,PURCHASE_RECEIPT,Initial Stock Inward\n' +
        'PROD-002,WH-MAIN,-5.0000,DAMAGE,Scrapped during inspection\n';
      filename = 'stock_import_template.csv';
    }

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
