import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import ProductEditPage from '../../../app/products/[id]/edit/page';
import { ProductForm } from '../product-form';
import { productsApi } from '../../../lib/api/products';
import { categoriesApi } from '../../../lib/api/categories';
import type { ProductDto, CategoryDto } from '@repo/types';

const mockPush = vi.fn();
let currentEditId = 'prod-123';
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useParams: () => ({
    id: currentEditId,
  }),
}));

const mockCategory: CategoryDto = {
  id: 'cat-111',
  organizationId: 'org-1',
  name: 'Office Supplies',
  description: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockProduct: ProductDto = {
  id: 'prod-123',
  organizationId: 'org-1',
  categoryId: 'cat-111',
  name: 'Standing Desk',
  sku: 'DESK-STAND-01',
  description: 'Motorized dual-motor standing desk',
  unitOfMeasure: 'UNIT',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  category: mockCategory,
};

describe('Product Edit Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('activeOrganizationId', 'org-1');
    vi.spyOn(categoriesApi, 'list').mockResolvedValue({
      data: [mockCategory],
      meta: { requestId: 'req-cats' },
    });
  });

  it('1. populates form with existing product values', () => {
    renderWithClient(
      <ProductForm
        mode="edit"
        initialValues={{
          name: mockProduct.name,
          sku: mockProduct.sku,
          categoryId: mockProduct.categoryId,
          description: mockProduct.description,
          unitOfMeasure: mockProduct.unitOfMeasure,
          status: mockProduct.status,
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('Standing Desk')).toBeInTheDocument();
    expect(screen.getByDisplayValue('DESK-STAND-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Motorized dual-motor standing desk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('2. renders loading skeleton in edit page while fetching product', () => {
    vi.spyOn(productsApi, 'getById').mockImplementation(() => new Promise(() => {}));

    renderWithClient(<ProductEditPage params={Promise.resolve({ id: 'prod-123' })} />);

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('3. renders product-not-found state when product does not exist', async () => {
    currentEditId = 'prod-nonexistent';
    vi.spyOn(productsApi, 'getById').mockRejectedValue(new Error('Product not found'));

    renderWithClient(<ProductEditPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Product not found' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /return to products catalog/i })).toBeInTheDocument();
  });

  it('4. loads existing product and allows updating fields', async () => {
    currentEditId = 'prod-123';
    vi.spyOn(productsApi, 'getById').mockResolvedValue({
      data: mockProduct,
      meta: { requestId: 'req-prod' },
    });

    vi.spyOn(productsApi, 'update').mockResolvedValue({
      data: { ...mockProduct, name: 'Premium Standing Desk' },
      meta: { requestId: 'req-update' },
    });

    renderWithClient(<ProductEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Standing Desk')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/product name/i);
    fireEvent.change(nameInput, { target: { value: 'Premium Standing Desk' } });

    const submitBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(productsApi.update).toHaveBeenCalledWith(
        'prod-123',
        expect.objectContaining({
          name: 'Premium Standing Desk',
          sku: 'DESK-STAND-01',
        }),
      );
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/products/prod-123');
    });
  });

  it('5. shows saving... loading state during update', () => {
    renderWithClient(
      <ProductForm
        mode="edit"
        initialValues={{
          name: mockProduct.name,
          sku: mockProduct.sku,
          categoryId: mockProduct.categoryId,
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isSubmitting={true}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: /saving\.\.\./i });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('6. handles edit API validation error gracefully', async () => {
    currentEditId = 'prod-123';
    vi.spyOn(productsApi, 'getById').mockResolvedValue({
      data: mockProduct,
      meta: { requestId: 'req-prod-val' },
    });

    vi.spyOn(productsApi, 'update').mockRejectedValue(
      new Error('Validation failed: Product name must be at least 2 characters'),
    );

    renderWithClient(<ProductEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Standing Desk')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(productsApi.update).toHaveBeenCalled();
    });

    // Should stay on page and not navigate
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('7. handles edit duplicate SKU conflict error from API', async () => {
    currentEditId = 'prod-123';
    vi.spyOn(productsApi, 'getById').mockResolvedValue({
      data: mockProduct,
      meta: { requestId: 'req-prod-conflict' },
    });

    vi.spyOn(productsApi, 'update').mockRejectedValue(
      new Error('A product with this SKU already exists in this organization'),
    );

    renderWithClient(<ProductEditPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Standing Desk')).toBeInTheDocument();
    });

    const skuInput = screen.getByLabelText(/sku/i);
    fireEvent.change(skuInput, { target: { value: 'DUPLICATE-SKU-01' } });

    const submitBtn = screen.getByRole('button', { name: /save changes/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(productsApi.update).toHaveBeenCalled();
    });

    // Should stay on edit page so user can fix the duplicate SKU
    expect(mockPush).not.toHaveBeenCalled();
  });
});
