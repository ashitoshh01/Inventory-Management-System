/**
 * Web Application Placeholder (@repo/web)
 * Next.js 16.x Active LTS application with React 19.x and Tailwind CSS
 * will be scaffolded in Phase 1D.
 *
 * NOTE: apps/web is strictly forbidden from importing @repo/database (ADR 0005).
 */

import { TYPES_PACKAGE_NAME } from '@repo/types';
import { UI_PACKAGE_NAME } from '@repo/ui';

export const WEB_APP_NAME = 'web';

export function getWebAppInfo(): { app: string; ui: string; types: string } {
  return {
    app: WEB_APP_NAME,
    ui: UI_PACKAGE_NAME,
    types: TYPES_PACKAGE_NAME,
  };
}
