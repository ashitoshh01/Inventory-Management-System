import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithClient } from '../../../test/test-utils';
import { TransferDetailCard } from '../transfer-detail-card';
import type { StockTransferDto } from '@repo/types';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

const mockTransfer: StockTransferDto = {
  id: 'tr-1',
  organizationId: 'org-1',
  transferNumber: 'TR-2026-999',
  status: 'DRAFT',
  sourceWarehouseId: 'wh-1',
  destinationWarehouseId: 'wh-2',
  notes: 'Fragile electronics transfer',
  sourceWarehouse: {
    id: 'wh-1',
    organizationId: 'org-1',
    name: 'Warehouse North',
    code: 'WH-N',
    description: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    postalCode: null,
    country: null,
    status: 'ACTIVE',
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  destinationWarehouse: {
    id: 'wh-2',
    organizationId: 'org-1',
    name: 'Warehouse South',
    code: 'WH-S',
    description: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    postalCode: null,
    country: null,
    status: 'ACTIVE',
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  lines: [
    {
      id: 'line-1',
      organizationId: 'org-1',
      transferId: 'tr-1',
      productId: 'prod-1',
      quantity: '10.0000',
      notes: 'Serial #1-10',
      product: {
        id: 'prod-1',
        organizationId: 'org-1',
        categoryId: 'cat-1',
        name: 'Industrial Valve',
        sku: 'SKU-VALVE-01',
        description: null,
        unitOfMeasure: 'UNIT',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  ],
};

describe('TransferDetailCard', () => {
  it('1. renders transfer information, warehouses, notes, and line items', () => {
    renderWithClient(<TransferDetailCard transfer={mockTransfer} onAction={vi.fn()} />);

    expect(screen.getByText('TR-2026-999')).toBeInTheDocument();
    expect(screen.getByText('Warehouse North')).toBeInTheDocument();
    expect(screen.getByText('Warehouse South')).toBeInTheDocument();
    expect(screen.getByText('Fragile electronics transfer')).toBeInTheDocument();
    expect(screen.getByText('SKU-VALVE-01')).toBeInTheDocument();
    expect(screen.getByText('Industrial Valve')).toBeInTheDocument();
    expect(screen.getByText('10.0000')).toBeInTheDocument();
    expect(screen.getByText('Serial #1-10')).toBeInTheDocument();
  });

  it('2. displays action buttons for DRAFT status', () => {
    renderWithClient(<TransferDetailCard transfer={mockTransfer} onAction={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Edit Transfer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve Transfer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel Transfer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete Draft/i })).toBeInTheDocument();
  });

  it('3. displays dispatch action for APPROVED status', () => {
    const approvedTransfer = { ...mockTransfer, status: 'APPROVED' as const };
    renderWithClient(<TransferDetailCard transfer={approvedTransfer} onAction={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Dispatch Stock/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel Transfer/i })).toBeInTheDocument();
  });

  it('4. displays receive action for IN_TRANSIT status', () => {
    const inTransitTransfer = { ...mockTransfer, status: 'IN_TRANSIT' as const };
    renderWithClient(<TransferDetailCard transfer={inTransitTransfer} onAction={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Receive Stock/i })).toBeInTheDocument();
  });
});
