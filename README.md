# Inventory Management System

Production-oriented inventory management system designed for a small/medium organization with an initial target of **~100 concurrent active users**.

The product is intentionally designed as a **decoupled modular monolith** within a pnpm/Turborepo monorepo, not microservices. At this scale, correctness, auditability, transactional inventory operations, security, observability, and maintainability matter more than distributed-system complexity.

> [!NOTE]
> **Historical Codebase Note**: The prior monolithic Next.js repository in git history (`HEAD~1`) is strictly historical. It must not be referenced as an authoritative architecture or implementation pattern.

## Reference UI

The supplied dashboard references establish the visual direction:

- dark navy left navigation
- clean light workspace
- blue/indigo primary actions
- KPI cards
- inventory tables with filters, pagination, status badges, and row actions
- sales/inventory charts
- recent activity
- expiry/low-stock visibility
- responsive behavior across desktop, tablet, and mobile

Do not copy sample or mock data from screenshots into production.

## Authoritative Tech Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Web (`apps/web`)**: Next.js 16.x Active LTS, React 19.x, TypeScript, Tailwind CSS
- **API (`apps/api`)**: NestJS, TypeScript
- **Database (`packages/database`)**: PostgreSQL 16+, Prisma ORM
- **Cache / Queues / Rate Limiting**: Redis, BullMQ
- **File Storage**: S3-compatible object storage (MinIO for local dev, AWS S3 / Cloudflare R2 for production)
- **Authentication & Security**: Argon2id password hashing, secure HTTP-only cookies / short-lived JWT + rotating refresh tokens, server-side RBAC with granular permissions, strict tenant isolation
- **Validation**: Zod (client and shared contracts), class-validator / Zod (NestJS DTOs)
- **Testing**: Vitest / Jest + Playwright (integration tests run against real PostgreSQL)
- **Containers**: Docker, Docker Compose
- **CI/CD**: GitHub Actions
- **Observability**: Structured JSON logs + OpenTelemetry-compatible tracing + error tracking

## Non-Negotiable Product Invariants

1. **PostgreSQL is the single source of truth**: Never use Redis or client state as authoritative stock storage.
2. **Stock mutations are transactional**: Every balance change occurs within a database transaction holding row locks (`SELECT FOR UPDATE`).
3. **Immutable inventory ledger**: Every stock modification writes to `StockLedgerEntry`. Historical ledger entries are never updated or deleted.
4. **Authoritative backend**: All business logic, stock allocation, and permission checks live in `apps/api`. No business logic in UI components or controllers.
5. **No direct frontend-to-database access**: `apps/web` must never import `packages/database` or connect directly to PostgreSQL.
6. **Mandatory tenant isolation**: Every tenant-owned record is scoped to `organizationId`. Every lookup guards against IDOR.
7. **Permission-based authorization**: Authorization uses fine-grained permissions (e.g. `inventory.adjust`), not hardcoded role names.
8. **Money & quantity precision**: Money is stored as integer minor units or exact `numeric`. Quantities support fractional precision.
9. **Idempotent mutations**: State-changing endpoints support `Idempotency-Key` headers.
10. **Immutable audit records**: Security events and critical mutations write to an append-only audit store.

## Repository Structure

```text
.
├── apps/
│   ├── web/                 # Next.js 16.x Active LTS application
│   └── api/                 # NestJS modular API
├── packages/
│   ├── ui/                  # Shared accessible UI primitives
│   ├── config/              # Shared TypeScript, ESLint, and Prettier configurations
│   ├── types/               # Shared domain primitives, DTO contracts, and API types
│   └── database/            # Prisma schema, migrations, seed routines, client export
├── docs/
│   ├── IMPLEMENTATION_ORDER.md
│   ├── DEFINITION_OF_DONE.md
│   ├── ENGINEERING_RULES.md
│   ├── PROJECT_CHECKLIST.md
│   ├── architecture.md
│   ├── product-requirements.md
│   ├── database.md
│   ├── api.md
│   ├── security.md
│   ├── testing.md
│   ├── deployment.md
│   ├── observability.md
│   ├── ui.md
│   ├── decisions.md
│   └── adr/
│       ├── 0001-modular-monolith.md
│       ├── 0002-inventory-ledger.md
│       ├── 0003-idempotent-mutations.md
│       ├── 0004-nextjs-version.md
│       └── 0005-database-package.md
├── infra/                   # Docker Compose, deployment, and infrastructure configs
├── .claude/
│   └── skills/              # Specialized AI coding agent skill packs
└── CLAUDE.md
```

## Implementation Roadmap

Implementation follows the sequence defined in [docs/IMPLEMENTATION_ORDER.md](file:///home/ashu/Desktop/Inventory-Management/docs/IMPLEMENTATION_ORDER.md). Every phase must satisfy [docs/DEFINITION_OF_DONE.md](file:///home/ashu/Desktop/Inventory-Management/docs/DEFINITION_OF_DONE.md) and adhere to [docs/ENGINEERING_RULES.md](file:///home/ashu/Desktop/Inventory-Management/docs/ENGINEERING_RULES.md).
