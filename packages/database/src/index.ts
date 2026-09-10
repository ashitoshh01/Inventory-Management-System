/**
 * Dedicated Shared Database Package (@repo/database)
 *
 * Invariant (ADR 0005 & ENGINEERING_RULES.md):
 * - Authoritative persistence configuration only.
 * - Exclusively consumed by apps/api and operational tooling (seed/migrate).
 * - CRITICAL INVARIANT: apps/web must NEVER import from or depend on this package.
 *
 * Prisma schema, migrations, seed routines, and PrismaClient singleton
 * will be implemented in Phase 1F.
 */

export const DATABASE_PACKAGE_NAME = '@repo/database';
