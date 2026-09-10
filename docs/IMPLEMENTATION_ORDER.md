# Master Implementation Order

This document defines the authoritative, sequential order for developing the Inventory Management System. Each phase builds strictly on the deliverables of preceding phases. No phase may be started until the preceding phase meets its Definition of Done.

---

## Phase 0.5 — Architecture & Documentation Normalization (Current)

**Goal:** Establish a single, internally consistent architectural truth and AI-agent context across all documentation and skills.

- Normalize documentation to the decoupled modular monolith architecture.
- Reconcile framework versions to Next.js 16.x Active LTS and React 19.x.
- Document architectural decisions (ADR 0004 for Next.js, ADR 0005 for `packages/database`).
- Establish `.claude/skills/` system.
- Formalize non-negotiable engineering rules and definitions of done.

---

## Phase 1A — Monorepo Foundation

**Goal:** Establish the root monorepo tooling, package orchestration, and shared configuration.

- Configure `pnpm-workspace.yaml`, root `package.json`, and `turbo.json`.
- Scaffold `packages/config` with shared TypeScript (`tsconfig.base.json`), ESLint, and Prettier rules.
- Scaffold `packages/types` with core domain primitives, DTO contracts, and API response types.
- Ensure `pnpm install`, `pnpm build`, and `pnpm lint` execute cleanly across empty workspace packages.

---

## Phase 1B — Development Infrastructure

**Goal:** Stand up containerized backing services for local development.

- Create `infra/docker-compose.yml` defining:
  - PostgreSQL 16+ (with healthcheck and persistent volume)
  - Redis 7+ (with healthcheck)
  - MinIO (S3-compatible object storage with default bucket creation)
- Create root `.env.example` with documented environment configurations.
- Verify that `docker compose up -d` brings all services to a healthy state.

---

## Phase 1C — Backend Foundation (`apps/api`)

**Goal:** Scaffold the core NestJS application runtime with global cross-cutting concerns.

- Initialize NestJS in `apps/api` with TypeScript and modular architecture.
- Configure global HTTP interceptors: correlation ID (`x-request-id`) generation and propagation.
- Implement structured JSON logging middleware.
- Configure global exception filters formatting errors into `{ error: { code, message, requestId } }`.
- Configure global validation pipes (class-validator / Zod).
- Implement health/readiness endpoints (`/health/liveness`, `/health/readiness`).

---

## Phase 1D — Frontend Foundation (`apps/web` & `packages/ui`)

**Goal:** Scaffold the Next.js 16.x Active LTS web application and design system primitives.

- Initialize Next.js 16.x Active LTS with App Router, React 19.x, and Tailwind CSS in `apps/web`.
- Implement shared UI primitives in `packages/ui` (Button, Input, Card, Modal, Table, Badge, EmptyState).
- Build the core application layout shell matching design specifications (dark navy sidebar, clean light canvas, header bar, responsive mobile drawer).
- Configure API client and TanStack Query provider with error boundary and correlation ID handling.

---

## Phase 1E — Authentication & Tenant Foundation

**Goal:** Implement multi-tenant identity, session security, and server-side RBAC.

- Implement `Organization` multi-tenant scoping and context extraction interceptor in `apps/api`.
- Implement `User`, `Role`, `Permission`, and `RolePermission` models.
- Implement password hashing using **Argon2id**.
- Build authentication endpoints (`POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`).
- Implement server-side permission guard (`@RequirePermissions(...)`).
- Build frontend `/login` screen and route-protection middleware.

---

## Phase 1F — Core Database & Catalog Domain Foundation

**Goal:** Implement authoritative catalog models, initial database migrations, and catalog APIs.

- Configure `packages/database` with `prisma/schema.prisma`:
  - `Organization`, `User`, `Role`, `Permission`
  - `Warehouse`, `WarehouseLocation`
  - `Category` (hierarchical parent/child), `Brand`, `UnitOfMeasure`
  - `Product`, `ProductVariant`, `ProductImage`
  - `StockBalance`, `StockLedgerEntry`, `IdempotencyRecord`
- Execute initial Prisma migration against PostgreSQL container.
- Implement deterministic seed script (`packages/database/prisma/seed.ts`).
- Build Catalog domain module in `apps/api` (Categories, Brands, Units, Products CRUD with barcode generation).
- Build Catalog management UI in `apps/web` (table with server pagination, search debounce, category trees, product creation modal).

---

## Phase 1G — Testing & CI Automation

**Goal:** Establish automated verification gates across all packages.

- Configure Vitest for backend and frontend unit tests.
- Implement database integration tests in `apps/api` verifying transactions, tenant isolation, and IDOR protection against real PostgreSQL.
- Configure Playwright in `apps/web` and write E2E tests for login and product creation flows.
- Create GitHub Actions workflow (`.github/workflows/ci.yml`) enforcing linting, typechecking, unit tests, and build verification on all PRs.

---

## Phase 2 — Inventory Core

**Goal:** Authoritative, transactional stock management with immutable ledger auditability.

- Implement `StockBalance` and `StockLedgerEntry` persistence routines with row-level locks (`SELECT FOR UPDATE`).
- Implement stock adjustment workflows (`POST /api/v1/inventory/adjustments`) with mandatory reason codes and idempotency.
- Implement stock reservation mechanics (`available = on_hand - reserved`).
- Implement stock transfer workflows between warehouses with explicit `IN_TRANSIT` states.
- Implement cycle count and inventory reconciliation workflows.
- Build Inventory management UI (stock level tables, adjustment modals, transfer workflows, ledger inspection views).

---

## Phase 3 — Purchasing, Receiving, Sales & Transfers

**Goal:** Full procurement and sales lifecycle with transactional stock deduction.

- **Purchasing**: Supplier CRUD, Purchase Order lifecycle (`DRAFT → SUBMITTED → APPROVED → PARTIALLY_RECEIVED → RECEIVED → CLOSED`), transactional goods receipt increasing stock via ledger.
- **Sales / POS**: Customer CRUD, Sales Order lifecycle, atomic stock reservation/deduction, invoice generation, fast POS checkout interface.
- **Returns**: Sales and purchase returns with restock decisions, ledger reversibility, and reason tracking.

---

## Phase 4 — Reports, Analytics & Forecasting

**Goal:** Aggregate transaction data into operational and predictive insight.

- Real-time KPI queries: total inventory valuation, out-of-stock items, fast-moving items.
- Asynchronous large-scale exports (CSV/Excel) via BullMQ background jobs.
- Low-stock and batch expiry scheduled scanning jobs.
- Basic moving-average demand forecasting and automated purchase order reorder recommendations.

---

## Phase 5 — Production Hardening

**Goal:** Security, resilience, and performance readiness for 100 concurrent active users.

- Enforce Redis-backed rate limiting on auth, search, mutations, and export endpoints.
- Add OpenTelemetry tracing and Prometheus metrics exporters.
- Conduct concurrency benchmark tests (simultaneous stock deductions) and verify zero negative stock.
- Query plan optimization (`EXPLAIN ANALYZE`), index tuning, and connection pool sizing.
- Automated database backup and disaster recovery drills.

---

## Phase 6 — UI Polish & Optimization

**Goal:** Visual excellence, responsive fluidity, and complete accessibility.

- Micro-interactions, skeleton loading polish, and toast notifications.
- Complete mobile and tablet responsiveness review for warehouse devices.
- Keyboard navigation shortcuts (quick search, command palette).
- WCAG AA accessibility audit.
