/**
 * Backend API Application Placeholder (@repo/api)
 * NestJS application runtime will be scaffolded in Phase 1C.
 */

import { DATABASE_PACKAGE_NAME } from '@repo/database';
import { TYPES_PACKAGE_NAME } from '@repo/types';

export const API_APP_NAME = 'api';

export function getApiAppInfo(): { app: string; db: string; types: string } {
  return {
    app: API_APP_NAME,
    db: DATABASE_PACKAGE_NAME,
    types: TYPES_PACKAGE_NAME,
  };
}
