---
name: architecture
description: Guidelines and invariants for system architecture, modular monolith boundaries, and workspace topology.
---

# Purpose

Governs the structural integrity, boundaries, and communication patterns of the decoupled modular monolith across the monorepo workspaces (`apps/web`, `apps/api`, and `packages/*`).

# When To Use

- When planning or introducing any new module, boundary, dependency, or inter-package relationship.
- When creating or modifying system components that touch multiple layers.
- When deciding whether a capability belongs in frontend, backend, or shared packages.

# Responsibilities

- Maintain strict separation between transport, application use cases, domain rules, and persistence layers.
- Ensure `apps/web` communicates with `apps/api` exclusively over typed HTTP/JSON API boundaries.
- Keep business logic centralized in NestJS domain and application services (`apps/api`).
- Guard against accidental cross-workspace bleeding (e.g. frontend importing database models).
- Enforce the modular monolith design and prevent premature distributed microservices complexity.

# Rules

1. **Decoupled Modular Monolith**: `apps/web` (Next.js 16.x Active LTS) and `apps/api` (NestJS) are separate applications within a pnpm/Turborepo monorepo.
2. **PostgreSQL as Single Source of Truth**: Redis, browser memory, or external services must never be treated as authoritative data stores.
3. **No Direct Frontend-to-Database Access**: `apps/web` must never import `packages/database`, Prisma, or connect directly to PostgreSQL.
4. **Strict Boundary Encapsulation**: Controllers handle HTTP transport; application services coordinate use cases and transactions; domain services enforce business logic; repositories handle persistence.
5. **Multi-Tenancy Everywhere**: Every tenant-owned model must possess an `organizationId` or an unambiguous ownership path.
6. **No Microservices without ADR**: All domains live inside the modular monolith until measured traffic or independent scaling requirements justify extraction via an accepted ADR.
7. **Boring Over Clever**: Prefer explicit, readable, strongly-typed code over complex metaprogramming or dynamic abstractions.

# Required Checks

- [ ] Verify that new modules conform to the standard NestJS domain module structure (`controllers/`, `application/`, `domain/`, `infrastructure/`, `dto/`).
- [ ] Ensure that `apps/web` only imports from `packages/types`, `packages/ui`, and `packages/config`.
- [ ] Validate that tenant scoping (`organizationId`) is enforced at the service boundary.
- [ ] Confirm that all transactional operations have explicit boundaries.
- [ ] Check that no circular package dependencies are introduced in `pnpm-workspace.yaml`.

# Common Mistakes

- Importing Prisma models or database client inside Next.js components or routes.
- Placing business validation logic inside React UI components or NestJS controllers.
- Bypassing the backend API using direct database connections or server actions directly querying SQL.
- Splitting the application into separate microservices prematurely for an initial ~100-user target.

# Definition Of Done

- Monorepo package topology and boundaries remain strictly respected with zero circular dependencies.
- No direct database access or business logic exists in `apps/web`.
- Any structural or boundary changes are documented in `docs/adr/`.
