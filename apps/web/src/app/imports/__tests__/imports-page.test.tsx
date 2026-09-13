import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import ImportsPage from '../page';
import { importsApi } from '../../../lib/api/imports';
import type { ImportJobDto } from '@repo/types';

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockJobs: ImportJobDto[] = [
  {
    id: 'job-1',
    organizationId: 'org-test',
    userId: 'user-1',
    type: 'PRODUCT',
    status: 'COMPLETED',
    fileName: 'products.csv',
    fileSize: 1024,
    totalRows: 50,
    processedRows: 50,
    successfulRows: 50,
    failedRows: 0,
    errors: null,
    completedAt: '2026-01-01T00:01:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:01:00.000Z',
  },
];

describe('Imports Page (/imports)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('activeOrganizationId', 'org-test');

    vi.spyOn(importsApi, 'listImportJobs').mockResolvedValue({
      data: mockJobs,
      meta: { requestId: 'req-list' },
    });
  });

  it('1. renders header, tabs, dropzone, and history table', async () => {
    renderWithClient(<ImportsPage />);

    expect(screen.getByRole('heading', { name: /import & bulk operations/i })).toBeInTheDocument();
    expect(screen.getByText(/product catalog import/i)).toBeInTheDocument();
    expect(screen.getByText(/stock & balance mutation import/i)).toBeInTheDocument();
    expect(screen.getByText(/click to upload or drag and drop your csv/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('products.csv')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  it('2. allows switching between Product Catalog and Stock tabs', async () => {
    renderWithClient(<ImportsPage />);

    const stockTab = screen.getByText(/stock & balance mutation import/i);
    fireEvent.click(stockTab);

    expect(mockReplace).toHaveBeenCalledWith('/imports?type=STOCK');
    expect(screen.getByText(/authoritative stock mutation guarantee:/i)).toBeInTheDocument();
  });

  it('3. allows toggling between CREATE and UPSERT modes for products', () => {
    renderWithClient(<ImportsPage />);

    const upsertBtn = screen.getByRole('button', { name: /upsert \(create or update\)/i });
    fireEvent.click(upsertBtn);

    expect(screen.getByText(/upsert mode creates new products and updates name, cost, and price/i)).toBeInTheDocument();
  });

  it('4. triggers template download on button click', () => {
    const downloadSpy = vi.spyOn(importsApi, 'downloadTemplate').mockImplementation(() => {});

    renderWithClient(<ImportsPage />);

    const downloadBtn = screen.getByRole('button', { name: /download product csv template/i });
    fireEvent.click(downloadBtn);

    expect(downloadSpy).toHaveBeenCalledWith('PRODUCT');
  });
});
