import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import { ProductDeleteDialog } from '../product-delete-dialog';
import { productsApi } from '../../../lib/api/products';
import type { ProductDto } from '@repo/types';

const mockProduct: ProductDto = {
  id: 'prod-to-delete-1',
  organizationId: 'org-1',
  categoryId: 'cat-1',
  name: 'Barcode Scanner Handheld',
  sku: 'SCAN-BAR-01',
  description: 'USB Laser Barcode Scanner',
  unitOfMeasure: 'UNIT',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Product Delete Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('activeOrganizationId', 'org-1');
  });

  it('1. confirmation dialog opens and displays product name and SKU', () => {
    renderWithClient(
      <ProductDeleteDialog product={mockProduct} open={true} onOpenChange={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { name: 'Delete Product' })).toBeInTheDocument();
    expect(screen.getByText('Barcode Scanner Handheld')).toBeInTheDocument();
    expect(screen.getByText('SKU: SCAN-BAR-01')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete product/i })).toBeInTheDocument();
  });

  it('2. cancel does not invoke delete API and triggers onOpenChange(false)', () => {
    const handleOpenChange = vi.fn();
    const deleteSpy = vi.spyOn(productsApi, 'delete');

    renderWithClient(
      <ProductDeleteDialog product={mockProduct} open={true} onOpenChange={handleOpenChange} />,
    );

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(handleOpenChange).toHaveBeenCalledWith(false);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('3. delete mutation executes and invokes onSuccess and onOpenChange(false)', async () => {
    const handleOpenChange = vi.fn();
    const handleSuccess = vi.fn();
    const deleteSpy = vi.spyOn(productsApi, 'delete').mockResolvedValue({
      data: { message: 'Product deleted', id: mockProduct.id },
      meta: { requestId: 'req-del' },
    });

    renderWithClient(
      <ProductDeleteDialog
        product={mockProduct}
        open={true}
        onOpenChange={handleOpenChange}
        onSuccess={handleSuccess}
      />,
    );

    const confirmDeleteBtn = screen.getByRole('button', { name: /delete product/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(mockProduct.id);
    });

    await waitFor(() => {
      expect(handleOpenChange).toHaveBeenCalledWith(false);
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('4. shows loading state during deletion', async () => {
    vi.spyOn(productsApi, 'delete').mockImplementation(() => new Promise(() => {}));

    renderWithClient(
      <ProductDeleteDialog product={mockProduct} open={true} onOpenChange={vi.fn()} />,
    );

    const confirmDeleteBtn = screen.getByRole('button', { name: /delete product/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deleting\.\.\./i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    });
  });

  it('5. handles 409 conflict error when product has dependencies', async () => {
    const handleOpenChange = vi.fn();
    vi.spyOn(productsApi, 'delete').mockRejectedValue(
      new Error('Cannot delete product because it has associated inventory transactions.'),
    );

    renderWithClient(
      <ProductDeleteDialog product={mockProduct} open={true} onOpenChange={handleOpenChange} />,
    );

    const confirmDeleteBtn = screen.getByRole('button', { name: /delete product/i });
    fireEvent.click(confirmDeleteBtn);

    // Should stay open so user is aware of error
    await waitFor(() => {
      expect(productsApi.delete).toHaveBeenCalledWith(mockProduct.id);
    });
    expect(handleOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('6. handles 403 forbidden error when user lacks delete permission', async () => {
    vi.spyOn(productsApi, 'delete').mockRejectedValue(
      new Error('Forbidden: You do not have permission product.delete in this organization.'),
    );

    renderWithClient(
      <ProductDeleteDialog product={mockProduct} open={true} onOpenChange={vi.fn()} />,
    );

    const confirmDeleteBtn = screen.getByRole('button', { name: /delete product/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(productsApi.delete).toHaveBeenCalledWith(mockProduct.id);
    });
  });

  it('7. handles network/API failure gracefully', async () => {
    vi.spyOn(productsApi, 'delete').mockRejectedValue(
      new Error('Network error: Unable to connect to server.'),
    );

    renderWithClient(
      <ProductDeleteDialog product={mockProduct} open={true} onOpenChange={vi.fn()} />,
    );

    const confirmDeleteBtn = screen.getByRole('button', { name: /delete product/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(productsApi.delete).toHaveBeenCalledWith(mockProduct.id);
    });
  });
});
