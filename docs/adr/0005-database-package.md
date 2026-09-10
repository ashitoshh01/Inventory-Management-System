# ADR 0005 — Dedicated Shared Database Package (`packages/database`)

## Status

Accepted

## Context

In a modular monorepo containing a NestJS backend (`apps/api`), potential standalone background worker scripts, CLI tooling, and database migration tasks, database access management must be cleanly centralized.

Two primary placement strategies were considered:

1. Co-locating Prisma inside `apps/api`.
2. Encapsulating Prisma schema, migrations, seed routines, and client generation inside a dedicated workspace package: `packages/database`.

## Decision

Introduce `packages/database` as a dedicated monorepo workspace package containing:

- `prisma/schema.prisma`
- SQL migrations
- Seed automation (`seed.ts`)
- Configured and typed `PrismaClient` singleton export

### Invariant & Access Rules

- `packages/database` is consumed exclusively by `apps/api` and direct operational CLI scripts (e.g. migration/seed runners).
- **CRITICAL INVARIANT**: `apps/web` must NEVER import from, depend upon, or reference `packages/database`. This invariant is enforced via workspace dependency exclusion and ESLint import boundary rules.
- All transactional boundaries, business logic, and stock ledger mutations remain orchestrated within `apps/api` services.

## Consequences

### Positive

- Isolated schema evolution: database migrations, client generation, and schema validation can run independently in CI/CD without booting the full NestJS API.
- Shared typing for backend workers: background job runners and CLI scripts can access the typed Prisma client without requiring circular imports into `apps/api`.
- Clean monorepo structure: keeps `apps/api` focused on NestJS application modules, controllers, and services.

### Negative

- Requires maintaining monorepo dependency boundaries to prevent accidental client-side imports in `apps/web`.
