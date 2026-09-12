'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Edit,
  Trash2,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Star,
  Package,
  FileText,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@repo/ui';
import { WarehouseStatusBadge } from './warehouse-status-badge';
import type { WarehouseDto } from '@repo/types';

interface WarehouseDetailCardProps {
  warehouse: WarehouseDto;
  onEdit?: () => void;
  onDelete?: () => void;
  canUpdate?: boolean;
  canDelete?: boolean;
}

export function WarehouseDetailCard({
  warehouse,
  onEdit,
  onDelete,
  canUpdate = true,
  canDelete = true,
}: WarehouseDetailCardProps) {
  const formattedCreated = new Date(warehouse.createdAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedUpdated = new Date(warehouse.updatedAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const addressParts = [
    warehouse.addressLine1,
    warehouse.addressLine2,
    warehouse.city,
    warehouse.state,
    warehouse.postalCode,
    warehouse.country,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Navigation and Top Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/warehouses"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Warehouses
        </Link>
        <div className="flex items-center gap-2">
          {canUpdate && onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4 text-muted-foreground" />
              Edit Facility
            </Button>
          )}
          {canDelete && onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Main Details Card */}
      <Card>
        <CardHeader className="border-b border-border pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-2xl font-bold tracking-tight">
                  {warehouse.name}
                </CardTitle>
                <WarehouseStatusBadge status={warehouse.status} />
                {warehouse.isDefault && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1"
                  >
                    <Star className="h-3 w-3 fill-current" />
                    Default Warehouse
                  </Badge>
                )}
              </div>
              <CardDescription className="font-mono text-sm">
                Facility Code:{' '}
                <span className="font-semibold text-foreground">{warehouse.code}</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Key Attributes Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1 rounded-lg border border-border p-4 bg-muted/20">
              <div className="flex items-center text-xs font-medium text-muted-foreground">
                <MapPin className="mr-1.5 h-3.5 w-3.5" />
                City & Region
              </div>
              <p className="text-base font-semibold text-foreground">
                {[warehouse.city, warehouse.state].filter(Boolean).join(', ') || '—'}
              </p>
            </div>

            <div className="space-y-1 rounded-lg border border-border p-4 bg-muted/20">
              <div className="flex items-center text-xs font-medium text-muted-foreground">
                <MapPin className="mr-1.5 h-3.5 w-3.5" />
                Country
              </div>
              <p className="text-base font-semibold text-foreground">{warehouse.country || '—'}</p>
            </div>

            <div className="space-y-1 rounded-lg border border-border p-4 bg-muted/20">
              <div className="flex items-center text-xs font-medium text-muted-foreground">
                <Star className="mr-1.5 h-3.5 w-3.5" />
                Allocation Priority
              </div>
              <p className="text-base font-semibold text-foreground">
                {warehouse.isDefault ? 'Default Destination' : 'Standard Location'}
              </p>
            </div>
          </div>

          {/* Full Physical Address */}
          <div className="rounded-lg border border-border p-4 bg-muted/10 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center">
              <MapPin className="mr-1.5 h-3.5 w-3.5" />
              Full Physical Address
            </h4>
            {addressParts.length > 0 ? (
              <div className="text-sm text-foreground space-y-0.5">
                {warehouse.addressLine1 && <p>{warehouse.addressLine1}</p>}
                {warehouse.addressLine2 && <p>{warehouse.addressLine2}</p>}
                <p>
                  {[warehouse.city, warehouse.state, warehouse.postalCode]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                {warehouse.country && <p>{warehouse.country}</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No street address provided.</p>
            )}
          </div>

          {/* Description */}
          {warehouse.description && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center">
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Overview & Operational Notes
              </h4>
              <p className="text-sm text-foreground/90 whitespace-pre-line rounded-lg border border-border p-4 bg-muted/10">
                {warehouse.description}
              </p>
            </div>
          )}

          {/* Audit Timestamps */}
          <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-muted-foreground border-t border-border">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Created {formattedCreated}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Last updated {formattedUpdated}
            </div>
          </div>

          {/* Stock placeholder (disabled card for future phase) */}
          <div className="rounded-lg border border-dashed border-border p-6 text-center bg-card/40">
            <Package className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <h4 className="text-sm font-medium text-foreground">Stock & Inventory Balance</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Inventory will appear here once stock management is implemented in future phases.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
