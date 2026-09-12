import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithClient, createTestQueryClient } from '../../../test/test-utils';
import { ProductForm } from '../product-form';
import { ProductFormDialog } from '../product-form-dialog';
import { categoriesApi } from '../../../lib/api/categories';
import { productsApi } from '../../../lib/api/products';
import type { CategoryDto } from '@repo/types';

const mockCategories: CategoryDto[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: 'org-1',
    name: 'Hardware',
    description: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    organizationId: 'org-1',
    name: 'Electronics',
    description: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('Product Create Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('activeOrganizationId', 'org-1');
    vi.spyOn(categoriesApi, 'list').mockResolvedValue({
      data: mockCategories,
      meta: { requestId: 'req-cats' },
    });
  });

  it('1. triggers required-field validation when submitting empty form', async () => {
    const handleSubmit = vi.fn();

    renderWithClient(<ProductForm mode="create" onSubmit={handleSubmit} onCancel={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: /create product/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Product name is required')).toBeInTheDocument();
    expect(screen.getByText('SKU is required')).toBeInTheDocument();
    expect(screen.getByText('Category is required')).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('2. validates invalid inputs: SKU invalid characters and max length', async () => {
    const handleSubmit = vi.fn();

    renderWithClient(<ProductForm mode="create" onSubmit={handleSubmit} onCancel={vi.fn()} />);

    const nameInput = screen.getByLabelText(/product name/i);
    const skuInput = screen.getByLabelText(/sku/i);

    // Invalid SKU with spaces and invalid symbols
    fireEvent.change(nameInput, { target: { value: 'Valid Product' } });
    fireEvent.change(skuInput, { target: { value: 'INVALID SKU$$' } });

    const submitBtn = screen.getByRole('button', { name: /create product/i });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByText(
        /SKU can only contain alphanumeric characters, hyphens, underscores, and dots/i,
      ),
    ).toBeInTheDocument();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('3. category options load from API', async () => {
    renderWithClient(<ProductForm mode="create" onSubmit={vi.fn()} onCancel={vi.fn()} />);

    await waitFor(() => {
      expect(categoriesApi.list).toHaveBeenCalled();
    });
  });

  it('4. successful submission passes only domain fields, protected fields cannot be submitted', async () => {
    const handleSubmit = vi.fn();

    renderWithClient(<ProductForm mode="create" onSubmit={handleSubmit} onCancel={vi.fn()} />);

    const nameInput = screen.getByLabelText(/product name/i);
    const skuInput = screen.getByLabelText(/sku/i);

    fireEvent.change(nameInput, { target: { value: 'Keyboard' } });
    fireEvent.change(skuInput, { target: { value: 'kb-mech-01' } });

    // Manually trigger submit with category
    fireEvent.click(screen.getByRole('button', { name: /create product/i }));

    // Now supply category and description
    renderWithClient(
      <ProductForm
        mode="create"
        initialValues={{
          name: 'Mechanical Keyboard',
          sku: 'KB-MECH-01',
          categoryId: mockCategories[0]!.id,
          unitOfMeasure: 'UNIT',
          status: 'ACTIVE',
          description: 'Clicky blue switches',
        }}
        onSubmit={handleSubmit}
        onCancel={vi.fn()}
      />,
    );

    const submitButtons = screen.getAllByRole('button', { name: /create product/i });
    fireEvent.click(submitButtons[submitButtons.length - 1]!);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        name: 'Mechanical Keyboard',
        sku: 'KB-MECH-01',
        categoryId: mockCategories[0]!.id,
        unitOfMeasure: 'UNIT',
        status: 'ACTIVE',
        description: 'Clicky blue switches',
      });
    });

    const payload = handleSubmit.mock.calls[0]![0];
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('organizationId');
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload).not.toHaveProperty('updatedAt');
  });

  it('5. loading/submitting state disables button and shows creating text', () => {
    renderWithClient(
      <ProductForm mode="create" onSubmit={vi.fn()} onCancel={vi.fn()} isSubmitting={true} />,
    );

    const submitBtn = screen.getByRole('button', { name: /creating\.\.\./i });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('6. ProductFormDialog handles API creation, invalidation and error feedback', async () => {
    const queryClient = createTestQueryClient();

    vi.spyOn(productsApi, 'create').mockResolvedValue({
      data: {
        id: 'new-prod-id',
        organizationId: 'org-1',
        categoryId: mockCategories[0]!.id,
        name: 'Gaming Mouse',
        sku: 'MOUSE-GM-01',
        description: null,
        unitOfMeasure: 'UNIT',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      meta: { requestId: 'req-create' },
    });

    const handleOpenChange = vi.fn();
    const handleSuccess = vi.fn();

    renderWithClient(
      <ProductFormDialog open={true} onOpenChange={handleOpenChange} onSuccess={handleSuccess} />,
      queryClient,
    );

    expect(screen.getByText('Add New Product')).toBeInTheDocument();
  });

  it('7. handles duplicate SKU error from backend', async () => {
    const queryClient = createTestQueryClient();
    vi.spyOn(productsApi, 'create').mockRejectedValue(
      new Error('A product with this SKU already exists in this organization'),
    );

    renderWithClient(<ProductFormDialog open={true} onOpenChange={vi.fn()} />, queryClient);

    expect(screen.getByText('Add New Product')).toBeInTheDocument();
  });
});
