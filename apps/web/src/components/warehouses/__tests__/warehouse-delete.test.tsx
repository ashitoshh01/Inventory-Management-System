import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WarehouseDeleteDialog } from '../warehouse-delete-dialog';
import { warehousesApi } from '../../../lib/api/warehouses';
import type { WarehouseDto } from '@repo/types';

const mockWarehouse: WarehouseDto = {
  id: 'wh-del-1',
  organizationId: 'org-test',
  name: 'Facility To Delete',
  code: 'WH-DEL-1',
  description: null,
  addressLine1: '50 Industrial Ave',
  addressLine2: null,
  city: 'Pune',
  state: 'Maharashtra',
  postalCode: '411001',
  country: 'India',
  status: 'ACTIVE',
  isDefault: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockDefaultWarehouse: WarehouseDto = {
  ...mockWarehouse,
  id: 'wh-default',
  name: 'Default Main Hub',
  code: 'WH-DEFAULT',
  isDefault: true,
};

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('WarehouseDeleteDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders confirmation dialog with warehouse name and code', () => {
    renderWithClient(
      <WarehouseDeleteDialog warehouse={mockWarehouse} open={true} onOpenChange={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { name: 'Delete Warehouse' })).toBeDefined();
    expect(screen.getByText('Facility To Delete')).toBeDefined();
    expect(screen.getByText('Code: WH-DEL-1')).toBeDefined();
  });

  it('shows warning when warehouse is designated as default', () => {
    renderWithClient(
      <WarehouseDeleteDialog warehouse={mockDefaultWarehouse} open={true} onOpenChange={vi.fn()} />,
    );

    expect(
      screen.getByText(/Warning: This warehouse is currently designated as the default warehouse/i),
    ).toBeDefined();
  });

  it('invokes delete API on confirm', async () => {
    const deleteSpy = vi.spyOn(warehousesApi, 'delete').mockResolvedValue(undefined as never);
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    renderWithClient(
      <WarehouseDeleteDialog
        warehouse={mockWarehouse}
        open={true}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />,
    );

    const deleteBtn = screen.getByRole('button', { name: 'Delete Warehouse' });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('wh-del-1');
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
