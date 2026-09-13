import { PaginationParams } from './domain.js';
import { CategoryDto } from './category.js';

export const UNIT_OF_MEASURE_VALUES = [
  'UNIT',
  'KG',
  'G',
  'L',
  'ML',
  'M',
  'CM',
  'BOX',
  'PACK',
] as const;
export type UnitOfMeasure = (typeof UNIT_OF_MEASURE_VALUES)[number];

export const PRODUCT_STATUS_VALUES = ['ACTIVE', 'INACTIVE'] as const;
export type ProductStatus = (typeof PRODUCT_STATUS_VALUES)[number];

export interface ProductDto {
  id: string;
  organizationId: string;
  categoryId: string;
  name: string;
  sku: string;
  description: string | null;
  unitOfMeasure: UnitOfMeasure;
  unitCost?: string | null | undefined;
  unitPrice?: string | null | undefined;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  category?: CategoryDto | undefined;
}

export interface CreateProductInput {
  categoryId: string;
  name: string;
  sku: string;
  description?: string | null | undefined;
  unitOfMeasure?: UnitOfMeasure | undefined;
  unitCost?: string | null | undefined;
  unitPrice?: string | null | undefined;
  status?: ProductStatus | undefined;
}

export interface UpdateProductInput {
  categoryId?: string | undefined;
  name?: string | undefined;
  sku?: string | undefined;
  description?: string | null | undefined;
  unitOfMeasure?: UnitOfMeasure | undefined;
  unitCost?: string | null | undefined;
  unitPrice?: string | null | undefined;
  status?: ProductStatus | undefined;
}

export interface ProductQueryParams extends PaginationParams {
  search?: string | undefined;
  categoryId?: string | undefined;
  status?: ProductStatus | undefined;
  unitOfMeasure?: UnitOfMeasure | undefined;
}
