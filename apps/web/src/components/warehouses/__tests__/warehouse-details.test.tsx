import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WarehouseDetailCard } from '../warehouse-detail-card';
import type { WarehouseDto } from '@repo/types';

const mockWarehouse: WarehouseDto = {
  id: 'wh-detail-1',
  organizationId: 'org-test',
  name: 'Western Logistics Center',
  code: 'WH-WEST',
  description: 'Major transit and distribution hub with high throughput.',
  addressLine1: '400 Industrial Corridor',
  addressLine2: 'Bay 12',
  city: 'Ahmedabad',
  state: 'Gujarat',
  postalCode: '380001',
  country: 'India',
  status: 'ACTIVE',
  isDefault: true,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-02T12:00:00.000Z',
};

describe('WarehouseDetailCard', () => {
  it('renders warehouse facility details, status, and default badge', () => {
    render(<WarehouseDetailCard warehouse={mockWarehouse} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText('Western Logistics Center')).toBeDefined();
    expect(screen.getByText('WH-WEST')).toBeDefined();
    expect(screen.getByText('Default Warehouse')).toBeDefined();
    expect(screen.getByText('Active')).toBeDefined();
    expect(
      screen.getByText('Major transit and distribution hub with high throughput.'),
    ).toBeDefined();
    expect(screen.getByText('400 Industrial Corridor')).toBeDefined();
    expect(screen.getByText('Ahmedabad, Gujarat')).toBeDefined();
    expect(screen.getByText(/Stock & Inventory Balance/i)).toBeDefined();
  });
});
