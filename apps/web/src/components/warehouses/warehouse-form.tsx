'use client';

import * as React from 'react';
import {
  Input,
  Textarea,
  Label,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui';
import {
  WAREHOUSE_STATUS_VALUES,
  type CreateWarehouseInput,
  type WarehouseStatus,
} from '@repo/types';

interface WarehouseFormProps {
  mode: 'create' | 'edit';
  initialValues?: {
    name?: string;
    code?: string;
    description?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
    status?: WarehouseStatus;
    isDefault?: boolean;
  };
  onSubmit: (data: CreateWarehouseInput) => Promise<void> | void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function WarehouseForm({
  mode,
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: WarehouseFormProps) {
  const [name, setName] = React.useState(initialValues?.name ?? '');
  const [code, setCode] = React.useState(initialValues?.code ?? '');
  const [description, setDescription] = React.useState(initialValues?.description ?? '');
  const [addressLine1, setAddressLine1] = React.useState(initialValues?.addressLine1 ?? '');
  const [addressLine2, setAddressLine2] = React.useState(initialValues?.addressLine2 ?? '');
  const [city, setCity] = React.useState(initialValues?.city ?? '');
  const [state, setState] = React.useState(initialValues?.state ?? '');
  const [postalCode, setPostalCode] = React.useState(initialValues?.postalCode ?? '');
  const [country, setCountry] = React.useState(initialValues?.country ?? '');
  const [status, setStatus] = React.useState<WarehouseStatus>(initialValues?.status ?? 'ACTIVE');
  const [isDefault, setIsDefault] = React.useState<boolean>(initialValues?.isDefault ?? false);

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!name.trim()) {
      nextErrors.name = 'Warehouse name is required';
    } else if (name.trim().length < 2) {
      nextErrors.name = 'Warehouse name must be at least 2 characters';
    } else if (name.trim().length > 100) {
      nextErrors.name = 'Warehouse name must be at most 100 characters';
    }

    if (!code.trim()) {
      nextErrors.code = 'Warehouse code is required';
    } else if (code.trim().length < 2) {
      nextErrors.code = 'Warehouse code must be at least 2 characters';
    } else if (code.trim().length > 50) {
      nextErrors.code = 'Warehouse code must be at most 50 characters';
    } else if (!/^[A-Za-z0-9_-]+$/.test(code.trim())) {
      nextErrors.code =
        'Warehouse code can only contain alphanumeric characters, hyphens, and underscores';
    }

    if (description && description.length > 1000) {
      nextErrors.description = 'Description must be at most 1000 characters';
    }

    if (addressLine1 && addressLine1.length > 200) {
      nextErrors.addressLine1 = 'Address line 1 must be at most 200 characters';
    }

    if (city && city.length > 200) {
      nextErrors.city = 'City must be at most 200 characters';
    }

    if (state && state.length > 200) {
      nextErrors.state = 'State must be at most 200 characters';
    }

    if (postalCode && postalCode.length > 200) {
      nextErrors.postalCode = 'Postal code must be at most 200 characters';
    }

    if (country && country.length > 200) {
      nextErrors.country = 'Country must be at most 200 characters';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: CreateWarehouseInput = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() ? description.trim() : null,
      addressLine1: addressLine1.trim() ? addressLine1.trim() : null,
      addressLine2: addressLine2.trim() ? addressLine2.trim() : null,
      city: city.trim() ? city.trim() : null,
      state: state.trim() ? state.trim() : null,
      postalCode: postalCode.trim() ? postalCode.trim() : null,
      country: country.trim() ? country.trim() : null,
      status,
      isDefault,
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Primary Details */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="warehouse-name">
            Warehouse Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="warehouse-name"
            placeholder="e.g. Central Distribution Hub"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
            }}
            disabled={isSubmitting}
            className={errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="warehouse-code">
            Facility Code <span className="text-destructive">*</span>
          </Label>
          <Input
            id="warehouse-code"
            placeholder="e.g. WH-MAIN"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (errors.code) setErrors((prev) => ({ ...prev, code: '' }));
            }}
            disabled={isSubmitting}
            className={`font-mono ${errors.code ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          />
          {errors.code ? (
            <p className="text-xs text-destructive">{errors.code}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Unique uppercase identifier within your organization.
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="warehouse-description">Description</Label>
        <Textarea
          id="warehouse-description"
          placeholder="Brief description or purpose of this storage location..."
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
          }}
          disabled={isSubmitting}
          rows={3}
          className={errors.description ? 'border-destructive focus-visible:ring-destructive' : ''}
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
      </div>

      {/* Address Information Section */}
      <div className="space-y-4 rounded-lg border border-border p-4 bg-muted/10">
        <h3 className="text-sm font-semibold text-foreground">Facility Address</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="warehouse-address1">Street Address</Label>
            <Input
              id="warehouse-address1"
              placeholder="e.g. 100 Logistics Boulevard"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="warehouse-address2">Address Line 2 (Optional)</Label>
            <Input
              id="warehouse-address2"
              placeholder="e.g. Building B, Dock 4"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="warehouse-city">City</Label>
            <Input
              id="warehouse-city"
              placeholder="e.g. Mumbai"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="warehouse-state">State / Province</Label>
            <Input
              id="warehouse-state"
              placeholder="e.g. Maharashtra"
              value={state}
              onChange={(e) => setState(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="warehouse-postal">Postal / Zip Code</Label>
            <Input
              id="warehouse-postal"
              placeholder="e.g. 400001"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="warehouse-country">Country</Label>
            <Input
              id="warehouse-country"
              placeholder="e.g. India"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      {/* Status & Default Settings */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 items-center">
        <div className="space-y-2">
          <Label htmlFor="warehouse-status">Operational Status</Label>
          <Select
            value={status}
            onValueChange={(val) => setStatus(val as WarehouseStatus)}
            disabled={isSubmitting}
          >
            <SelectTrigger id="warehouse-status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {WAREHOUSE_STATUS_VALUES.map((st) => (
                <SelectItem key={st} value={st}>
                  {st === 'ACTIVE' ? 'Active' : 'Inactive'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-3 pt-6 sm:pt-0">
          <input
            type="checkbox"
            id="warehouse-is-default"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            disabled={isSubmitting}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
          <Label htmlFor="warehouse-is-default" className="text-sm font-medium cursor-pointer">
            Set as Default Warehouse
            <span className="block text-xs text-muted-foreground font-normal">
              Primary location for incoming inventory allocations.
            </span>
          </Label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? mode === 'create'
              ? 'Creating...'
              : 'Saving...'
            : mode === 'create'
              ? 'Create Warehouse'
              : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
