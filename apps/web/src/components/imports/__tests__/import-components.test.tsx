import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, render, cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
import { ImportDropzone } from '../import-dropzone';
import { ImportPreviewTable } from '../import-preview-table';
import { ImportProgress } from '../import-progress';
import type { ImportPreviewDto, ImportJobDto } from '@repo/types';

describe('ImportDropzone Component', () => {
  it('renders upload prompt when no file is selected', () => {
    const onFileSelect = vi.fn();
    render(<ImportDropzone selectedFile={null} onFileSelect={onFileSelect} />);

    expect(screen.getByText(/click to upload or drag and drop your csv/i)).toBeDefined();
    expect(screen.getByText(/rfc 4180 standard csv file up to 10mb/i)).toBeDefined();
  });

  it('renders selected file name, size, and remove button when file is provided', () => {
    const onFileSelect = vi.fn();
    const file = new File(['sku,name\nP1,Item'], 'products.csv', { type: 'text/csv' });

    render(<ImportDropzone selectedFile={file} onFileSelect={onFileSelect} />);

    expect(screen.getByText('products.csv')).toBeDefined();
    const removeBtn = screen.getByRole('button', { name: /remove selected file/i });
    expect(removeBtn).toBeDefined();

    fireEvent.click(removeBtn);
    expect(onFileSelect).toHaveBeenCalledWith(null);
  });

  it('shows error if non-CSV file is selected', () => {
    const onFileSelect = vi.fn();
    render(<ImportDropzone selectedFile={null} onFileSelect={onFileSelect} />);

    const input = screen.getByLabelText(/upload csv file/i);
    const badFile = new File(['hello'], 'document.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [badFile] } });
    expect(screen.getByText(/only .csv files are supported/i)).toBeDefined();
    expect(onFileSelect).not.toHaveBeenCalled();
  });
});

describe('ImportPreviewTable Component', () => {
  const mockPreview: ImportPreviewDto = {
    type: 'PRODUCT',
    fileName: 'products.csv',
    fileSize: 1024,
    totalRows: 2,
    validRows: 1,
    invalidRows: 1,
    errors: [
      { row: 3, column: 'name', code: 'REQUIRED_FIELD_MISSING', message: 'Name is required' },
    ],
    previewRows: [
      {
        rowNumber: 2,
        data: { sku: 'PROD-01', name: 'Hammer', category: 'Tools', unitCost: '10', unitPrice: '20', reorderPoint: '5' },
        isValid: true,
        errors: [],
      },
      {
        rowNumber: 3,
        data: { sku: 'PROD-02', name: '', category: 'Tools', unitCost: '5', unitPrice: '10', reorderPoint: '0' },
        isValid: false,
        errors: [
          { row: 3, column: 'name', code: 'REQUIRED_FIELD_MISSING', message: 'Name is required' },
        ],
      },
    ],
    headers: ['sku', 'name', 'category', 'unitCost', 'unitPrice', 'reorderPoint'],
  };

  it('renders summary statistics cards for total, valid, and invalid rows', () => {
    render(<ImportPreviewTable preview={mockPreview} type="PRODUCT" />);

    expect(screen.getByText('Total Rows')).toBeDefined();
    expect(screen.getByText('Valid Rows')).toBeDefined();
    expect(screen.getByText('Invalid Rows')).toBeDefined();
    expect(screen.getByText('Validation warning:')).toBeDefined();
  });

  it('filters rows by valid or invalid mode', () => {
    render(<ImportPreviewTable preview={mockPreview} type="PRODUCT" />);

    // Initially shows both
    expect(screen.getByText('PROD-01')).toBeDefined();
    expect(screen.getByText('PROD-02')).toBeDefined();

    // Click "Valid" filter
    const validBtn = screen.getByRole('button', { name: /^valid/i });
    fireEvent.click(validBtn);
    expect(screen.getByText('PROD-01')).toBeDefined();
    expect(screen.queryByText('PROD-02')).toBeNull();

    // Click "Invalid" filter
    const invalidBtn = screen.getByRole('button', { name: /^invalid/i });
    fireEvent.click(invalidBtn);
    expect(screen.queryByText('PROD-01')).toBeNull();
    expect(screen.getByText('PROD-02')).toBeDefined();
  });
});

describe('ImportProgress Component', () => {
  const mockJob: ImportJobDto = {
    id: 'job-abc-123',
    organizationId: 'org-test',
    userId: 'user-test',
    type: 'PRODUCT',
    status: 'COMPLETED',
    fileName: 'products.csv',
    fileSize: 1024,
    totalRows: 10,
    processedRows: 10,
    successfulRows: 8,
    failedRows: 2,
    errors: [
      { row: 4, column: 'sku', code: 'DUPLICATE_SKU', message: 'SKU already exists' },
      { row: 7, column: 'name', code: 'REQUIRED', message: 'Name is required' },
    ],
    completedAt: '2026-01-01T00:05:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:05:00.000Z',
  };

  it('renders completed status badge and progress counts', () => {
    const onReset = vi.fn();
    render(<ImportProgress job={mockJob} onReset={onReset} />);

    expect(screen.getByText(/completed successfully/i)).toBeDefined();
    expect(screen.getByText('10 of 10 rows (100%)')).toBeDefined();
    expect(screen.getByText('8')).toBeDefined(); // successful
    expect(screen.getByText('2')).toBeDefined(); // failed
    expect(screen.getByText(/2 row\(s\) failed during import/i)).toBeDefined();
  });

  it('renders download error CSV button when failed rows exist', () => {
    const onReset = vi.fn();
    render(<ImportProgress job={mockJob} onReset={onReset} />);

    const downloadBtn = screen.getByRole('button', { name: /download error csv/i });
    expect(downloadBtn).toBeDefined();

    const resetBtn = screen.getByRole('button', { name: /import another file/i });
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
