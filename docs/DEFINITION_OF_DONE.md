# Definition of Done

A phase is only considered complete when all criteria under its corresponding section are fully satisfied and verified. Code that compiles but lacks tests, authorization enforcement, or documentation does not meet the Definition of Done.

---

## Phase 0.5 — Architecture & Documentation Normalization
- [ ] All architectural documentation and ADRs are internally consistent.
- [ ] Framework targets are specified as Next.js 16.x Active LTS and React 19.x.
- [ ] Monorepo structure (`apps/*`, `packages/*`, `infra/`) is fully agreed and documented.
- [ ] `.claude/skills/` contains complete, detailed `SKILL.md` files for all 13 core disciplines.
- [ ] Non-negotiable engineering rules are codified in `docs/ENGINEERING_RULES.md`.
- [ ] No application code, dependencies, or placeholder scaffolds exist yet.

---

## Phase 1A — Monorepo Foundation
- [ ] `pnpm-workspace.yaml`, root `package.json`, and `turbo.json` are initialized.
- [ ] `packages/config` exports functioning base `tsconfig.json`, ESLint, and Prettier configurations.
- [ ] `packages/types` builds and exports core TypeScript interfaces and shared contracts.
- [ ] `pnpm install`, `pnpm build`, `pnpm lint`, and `pnpm typecheck` execute without errors across all packages.

---

## Phase 1B — Development Infrastructure
- [ ] `infra/docker-compose.yml` starts PostgreSQL 16+, Redis 7+, and MinIO.
- [ ] Healthchecks for PostgreSQL and Redis pass consistently.
- [ ] Root `.env.example` documents all required development environment variables.
- [ ] Local persistence is verified across container restarts via mounted volumes.

---

## Phase 1C — Backend Foundation (`apps/api`)
- [ ] NestJS boots cleanly on port 4000 (or configured `PORT`).
- [ ] Correlation ID (`x-request-id`) is generated/propagated and attached to every response.
- [ ] Structured JSON logger outputs required fields (`timestamp`, `service`, `level`, `requestId`).
- [ ] Global exception filter returns standard error envelopes (`{ error: { code, message, requestId } }`).
- [ ] Liveness and readiness health endpoints return 200 OK.

---

## Phase 1D — Frontend Foundation (`apps/web` & `packages/ui`)
- [ ] Next.js 16.x Active LTS boots cleanly with React 19.x and Tailwind CSS.
- [ ] `packages/ui` exports core accessible primitives (Button, Input, Card, Modal, Table, Badge).
- [ ] Responsive application layout (dark navy sidebar, light workspace canvas, top navigation, mobile drawer) renders smoothly.
- [ ] TanStack Query client is configured with correlation headers and unified error handling.

---

## Phase 1E — Authentication & Tenant Foundation
- [ ] Passwords hashed with Argon2id; zero plaintext password storage.
- [ ] Login endpoint (`POST /api/v1/auth/login`) issues secure HTTP-only cookies or JWT tokens.
- [ ] Current session endpoint (`GET /api/v1/auth/me`) returns authenticated user profile and permissions.
- [ ] Server-side permission guard rejects unauthorized requests with 403 Forbidden.
- [ ] Tenant context interceptor verifies `organizationId` on all authenticated operations.
- [ ] Frontend `/login` screen handles submission, validation errors, and redirects to dashboard.

---

## Phase 1F — Core Database & Catalog Domain Foundation
- [ ] `packages/database` schema includes `Organization`, `User`, `Warehouse`, `Category`, `Brand`, `UnitOfMeasure`, `Product`, `StockBalance`, `StockLedgerEntry`, and `IdempotencyRecord`.
- [ ] Initial Prisma migration executes without errors against PostgreSQL.
- [ ] Seed script executes deterministically, creating default organization, roles, permissions, and admin user.
- [ ] Catalog API routes (`/api/v1/categories`, `/api/v1/products`) support CRUD, pagination, and search.
- [ ] Catalog UI displays paginated data table, category trees, and product creation modal with validation.

---

## Phase 1G — Testing & CI Automation
- [ ] Unit test suites pass with zero warnings in `apps/api` and `apps/web`.
- [ ] Database integration tests execute against a real PostgreSQL container.
- [ ] Authorization and IDOR tests prove cross-tenant data access is blocked.
- [ ] Playwright E2E tests for login and product creation pass reliably.
- [ ] GitHub Actions CI workflow runs green on pull requests.

---

## Phase 2 — Inventory Core
- [ ] Stock mutations execute within PostgreSQL transactions with row-level locks (`SELECT FOR UPDATE`).
- [ ] Every balance mutation appends an immutable `StockLedgerEntry` record.
- [ ] Stock equation invariant (`available = on_hand - reserved >= 0`) is strictly enforced.
- [ ] Concurrency tests prove simultaneous attempts to consume the same stock do not result in negative stock.
- [ ] Stock adjustment, transfer, and cycle count endpoints support idempotency keys.

---

## Phase 3 — Purchasing, Receiving, Sales & Transfers
- [ ] Purchase order lifecycle transitions strictly through validated status states.
- [ ] Goods receipt increments stock balances and creates ledger entries atomically.
- [ ] Sales orders reserve stock upon confirmation and deduct stock upon shipment.
- [ ] Point-of-sale checkout executes atomically using the core sales transaction engine.
- [ ] Returns properly restore inventory and create audit records.

---

## Phase 4 — Reports, Analytics & Forecasting
- [ ] Inventory valuation queries execute efficiently using database indexes.
- [ ] Bulk import and export jobs run asynchronously via BullMQ workers.
- [ ] Scheduled background jobs scan for low-stock and batch expiry, emitting deduplicated alerts.
- [ ] Moving average reorder suggestions populate on purchasing screens.

---

## Phase 5 — Production Hardening
- [ ] Rate limiters are verified on auth, mutations, search, and export routes.
- [ ] Latency targets are achieved under 100 concurrent simulated users (p95 reads < 500 ms, writes < 750 ms).
- [ ] Structured logging redacts all sensitive fields and tokens.
- [ ] Database backup and point-in-time recovery runbook is documented and tested.

---

## Phase 6 — UI Polish & Optimization
- [ ] All data tables support server-side pagination, sorting, search debounce, and empty/error states.
- [ ] WCAG AA accessibility audit passes with zero critical issues.
- [ ] Application is verified on desktop, tablet, and mobile browsers.
- [ ] Keyboard navigation and focus rings function across all interactive components.
