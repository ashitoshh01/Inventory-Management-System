/**
 * Shared UI Package (@repo/ui)
 * Accessible design primitives and UI components will be implemented in Phase 1D.
 */

import { TYPES_PACKAGE_NAME } from '@repo/types';

export const UI_PACKAGE_NAME = '@repo/ui';

export function getUiPackageInfo(): { name: string; typesPackage: string } {
  return {
    name: UI_PACKAGE_NAME,
    typesPackage: TYPES_PACKAGE_NAME,
  };
}
