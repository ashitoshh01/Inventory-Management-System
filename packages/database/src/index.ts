/**
 * Dedicated Shared Database Package (@repo/database)
 *
 * Invariant (ADR 0005 & ENGINEERING_RULES.md):
 * - Authoritative persistence configuration only.
 * - Exclusively consumed by apps/api and operational tooling (seed/migrate).
 * - CRITICAL INVARIANT: apps/web must NEVER import from or depend on this package.
 */

export * from '@prisma/client';
export { PrismaService } from './prisma.service.js';
export { PrismaModule } from './prisma.module.js';

export const DATABASE_PACKAGE_NAME = '@repo/database';
