'use client';

import * as React from 'react';
import Link from 'next/link';
import { Edit, Trash2, ArrowLeft, Calendar, Tag, Package, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@repo/ui';
import type { ProductDto } from '@repo/types';

interface ProductDetailCardProps {
  product: ProductDto;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ProductDetailCard({ product, onEdit, onDelete }: ProductDetailCardProps) {
  const formattedCreated = new Date(product.createdAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedUpdated = new Date(product.updatedAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-6">
      {/* Top back navigation and actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/products"
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Products
        </Link>
        <div className="flex items-center gap-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4 text-muted-foreground" />
              Edit Product
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Main product card */}
      <Card>
        <CardHeader className="border-b border-border pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle className="text-2xl font-bold tracking-tight">{product.name}</CardTitle>
                {product.status === 'ACTIVE' ? (
                  <Badge
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-600/90 text-white"
                  >
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
              <CardDescription className="font-mono text-sm">
                SKU: <span className="font-semibold text-foreground">{product.sku}</span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Attributes Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1 rounded-lg border border-border p-4 bg-muted/20">
              <div className="flex items-center text-xs font-medium text-muted-foreground">
                <Tag className="mr-1.5 h-3.5 w-3.5" />
                Category
              </div>
              <p className="text-base font-semibold text-foreground">
                {product.category?.name ?? '—'}
              </p>
            </div>

            <div className="space-y-1 rounded-lg border border-border p-4 bg-muted/20">
              <div className="flex items-center text-xs font-medium text-muted-foreground">
                <Package className="mr-1.5 h-3.5 w-3.5" />
                Unit of Measure
              </div>
              <p className="text-base font-semibold text-foreground">{product.unitOfMeasure}</p>
            </div>

            <div className="space-y-1 rounded-lg border border-border p-4 bg-muted/20">
              <div className="flex items-center text-xs font-medium text-muted-foreground">
                <Calendar className="mr-1.5 h-3.5 w-3.5" />
                Date Created
              </div>
              <p className="text-sm font-semibold text-foreground">{formattedCreated}</p>
            </div>

            <div className="space-y-1 rounded-lg border border-border p-4 bg-muted/20">
              <div className="flex items-center text-xs font-medium text-muted-foreground">
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                Last Modified
              </div>
              <p className="text-sm font-semibold text-foreground">{formattedUpdated}</p>
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-2 rounded-lg border border-border p-4 bg-muted/10">
            <h4 className="text-sm font-semibold text-foreground">Description</h4>
            {product.description ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {product.description}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                No description provided for this product.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
