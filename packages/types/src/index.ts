/**
 * Shared Types Package (@repo/types)
 * Reserved for cross-boundary contracts, shared DTO types, and API response envelopes.
 * Domain types will be established in subsequent phases (Phase 1E/1F).
 */

export const TYPES_PACKAGE_NAME = '@repo/types';

/**
 * Common pagination query parameters contract placeholder.
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}
export * from './auth.js';
export * from './domain.js';
export * from './category.js';
export * from './product.js';
export * from './warehouse.js';
