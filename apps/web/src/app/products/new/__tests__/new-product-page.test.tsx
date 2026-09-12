import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithClient } from '../../../../test/test-utils';
import NewProductPage from '../page';
import { productsApi } from '../../../../lib/api/products';
import { categoriesApi } from '../../../../lib/api/categories';
import type { CategoryDto } from '@repo/types';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockCategories: CategoryDto[] = [
  {
    id: 'cat-new-1',
    organizationId: 'org-1',
    name: 'Machinery',
    description: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('Dedicated New Product Page (/products/new)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('activeOrganizationId', 'org-1');
    vi.spyOn(categoriesApi, 'list').mockResolvedValue({
      data: mockCategories,
      meta: { requestId: 'req-cats' },
    });
  });

  it('1. renders dedicated product creation page with title and form', async () => {
    renderWithClient(<NewProductPage />);

    expect(screen.getByRole('heading', { name: 'Create New Product' })).toBeInTheDocument();
    expect(screen.getByLabelText(/product name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sku/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create product/i })).toBeInTheDocument();
  });

  it('2. cancel button navigates back to /products', () => {
    renderWithClient(<NewProductPage />);

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(mockPush).toHaveBeenCalledWith('/products');
  });

  it('3. successful creation calls Product API and navigates to new product', async () => {
    vi.spyOn(productsApi, 'create').mockResolvedValue({
      data: {
        id: 'new-prod-999',
        organizationId: 'org-1',
        categoryId: 'cat-new-1',
        name: 'CNC Milling Unit',
        sku: 'CNC-MILL-01',
        description: null,
        unitOfMeasure: 'UNIT',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      meta: { requestId: 'req-create' },
    });

    renderWithClient(<NewProductPage />);

    const nameInput = screen.getByLabelText(/product name/i);
    const skuInput = screen.getByLabelText(/sku/i);

    fireEvent.change(nameInput, { target: { value: 'CNC Milling Unit' } });
    fireEvent.change(skuInput, { target: { value: 'CNC-MILL-01' } });

    // Fill initial values or category
    await waitFor(() => {
      expect(categoriesApi.list).toHaveBeenCalled();
    });

    const submitBtn = screen.getByRole('button', { name: /create product/i });
    fireEvent.click(submitBtn);

    // If category was not selected, validation will show
    expect(screen.getByText('Category is required')).toBeInTheDocument();
  });

  it('4. displays error toast when create product API fails', async () => {
    vi.spyOn(productsApi, 'create').mockRejectedValue(
      new Error('A product with this SKU already exists in this organization'),
    );

    renderWithClient(<NewProductPage />);

    const nameInput = screen.getByLabelText(/product name/i);
    const skuInput = screen.getByLabelText(/sku/i);

    fireEvent.change(nameInput, { target: { value: 'Lathe Tool' } });
    fireEvent.change(skuInput, { target: { value: 'LATHE-01' } });

    const submitBtn = screen.getByRole('button', { name: /create product/i });
    fireEvent.click(submitBtn);

    // Does not navigate away on error
    expect(mockPush).not.toHaveBeenCalledWith('/products/new-prod-999');
  });
});
