import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WarehouseStatusBadge } from '../warehouse-status-badge';

describe('WarehouseStatusBadge', () => {
  it('renders Active badge with correct text', () => {
    render(<WarehouseStatusBadge status="ACTIVE" />);
    const badge = screen.getByText('Active');
    expect(badge).toBeDefined();
  });

  it('renders Inactive badge with correct text', () => {
    render(<WarehouseStatusBadge status="INACTIVE" />);
    const badge = screen.getByText('Inactive');
    expect(badge).toBeDefined();
  });
});
