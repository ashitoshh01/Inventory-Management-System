import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import ProductDetailPage from '../../../app/products/[id]/page';
import { ProductDetailCard } from '../product-detail-card';
import { productsApi } from '../../../lib/api/products';
import type { ProductDto } from '@repo/types';

const mockPush = vi.fn();
let currentParamId = 'prod-456';
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useParams: () => ({
    id: currentParamId,
  }),
}));

const mockProduct: ProductDto = {
  id: 'prod-456',
  organizationId: 'org-1',
  categoryId: 'cat-1',
  name: 'Industrial Label Printer',
  sku: 'PRINT-LBL-01',
  description: 'Direct thermal industrial barcode label printer',
  unitOfMeasure: 'UNIT',
  status: 'ACTIVE',
  createdAt: '2026-02-01T10:00:00.000Z',
  updatedAt: '2026-02-02T11:00:00.000Z',
  category: {
    id: 'cat-1',
    organizationId: 'org-1',
    name: 'Printers & Imaging',
    description: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

describe('Product Details Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('activeOrganizationId', 'org-1');
  });

  it('1. renders product details accurately in ProductDetailCard', () => {
    renderWithClient(
      <ProductDetailCard product={mockProduct} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );

    expect(screen.getByText('Industrial Label Printer')).toBeInTheDocument();
    expect(screen.getByText('PRINT-LBL-01')).toBeInTheDocument();
    expect(screen.getByText('Printers & Imaging')).toBeInTheDocument();
    expect(screen.getByText('UNIT')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(
      screen.getByText(/Direct thermal industrial barcode label printer/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit product/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('2. triggers edit and delete action handlers', () => {
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();

    renderWithClient(
      <ProductDetailCard product={mockProduct} onEdit={handleEdit} onDelete={handleDelete} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /edit product/i }));
    expect(handleEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(handleDelete).toHaveBeenCalledTimes(1);
  });

  it('3. renders loading state while page fetches product', () => {
    currentParamId = 'prod-456';
    vi.spyOn(productsApi, 'getById').mockImplementation(() => new Promise(() => {}));

    renderWithClient(<ProductDetailPage />);

    // Should render skeletons in card
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('4. renders not-found and API error state gracefully', async () => {
    currentParamId = 'prod-unknown';
    vi.spyOn(productsApi, 'getById').mockRejectedValue(
      new Error('Product not found in this organization'),
    );

    renderWithClient(<ProductDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Product not found')).toBeInTheDocument();
    });
    expect(screen.getByText(/Product not found in this organization/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to products catalog/i })).toBeInTheDocument();
  });

  it('5. full detail page loads product and hooks up edit/delete handlers', async () => {
    currentParamId = 'prod-456';
    vi.spyOn(productsApi, 'getById').mockResolvedValue({
      data: mockProduct,
      meta: { requestId: 'req-prod-get' },
    });

    renderWithClient(<ProductDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Industrial Label Printer')).toBeInTheDocument();
    });

    const editBtn = screen.getByRole('button', { name: /edit product/i });
    fireEvent.click(editBtn);
    expect(mockPush).toHaveBeenCalledWith('/products/prod-456/edit');
  });
});
