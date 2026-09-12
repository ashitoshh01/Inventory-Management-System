import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WarehouseForm } from '../warehouse-form';

describe('WarehouseForm', () => {
  it('renders all form input fields and labels', () => {
    render(<WarehouseForm mode="create" onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/Warehouse Name/i)).toBeDefined();
    expect(screen.getByLabelText(/Facility Code/i)).toBeDefined();
    expect(screen.getByLabelText(/Description/i)).toBeDefined();
    expect(screen.getByLabelText(/Street Address/i)).toBeDefined();
    expect(screen.getByLabelText(/City/i)).toBeDefined();
    expect(screen.getByLabelText(/State \/ Province/i)).toBeDefined();
    expect(screen.getByLabelText(/Postal \/ Zip Code/i)).toBeDefined();
    expect(screen.getByLabelText(/Country/i)).toBeDefined();
    expect(screen.getByLabelText(/Set as Default Warehouse/i)).toBeDefined();
  });

  it('validates required fields on empty submit', async () => {
    const onSubmit = vi.fn();
    render(<WarehouseForm mode="create" onSubmit={onSubmit} onCancel={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: 'Create Warehouse' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Warehouse name is required')).toBeDefined();
      expect(screen.getByText('Warehouse code is required')).toBeDefined();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('validates invalid characters in warehouse code', async () => {
    const onSubmit = vi.fn();
    render(<WarehouseForm mode="create" onSubmit={onSubmit} onCancel={vi.fn()} />);

    const nameInput = screen.getByLabelText(/Warehouse Name/i);
    const codeInput = screen.getByLabelText(/Facility Code/i);

    fireEvent.change(nameInput, { target: { value: 'Valid Facility' } });
    fireEvent.change(codeInput, { target: { value: 'WH@SPECIAL#1' } });

    const submitBtn = screen.getByRole('button', { name: 'Create Warehouse' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Warehouse code can only contain alphanumeric characters, hyphens, and underscores',
        ),
      ).toBeDefined();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('submits valid payload with normalized uppercase code', async () => {
    const onSubmit = vi.fn();
    render(<WarehouseForm mode="create" onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Warehouse Name/i), {
      target: { value: '  Eastern Hub  ' },
    });
    fireEvent.change(screen.getByLabelText(/Facility Code/i), {
      target: { value: 'wh-east' },
    });
    fireEvent.change(screen.getByLabelText(/City/i), {
      target: { value: 'Kolkata' },
    });

    const submitBtn = screen.getByRole('button', { name: 'Create Warehouse' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Eastern Hub',
          code: 'WH-EAST',
          city: 'Kolkata',
          status: 'ACTIVE',
          isDefault: false,
        }),
      );
    });
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<WarehouseForm mode="create" onSubmit={vi.fn()} onCancel={onCancel} />);

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalled();
  });
});
