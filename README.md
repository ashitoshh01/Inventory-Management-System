# Inventory Management System

Production-oriented inventory management system designed for a small/medium organization with an initial target of **~100 concurrent active users**.

The product is intentionally designed as a **modular monolith**, not microservices. At this scale, correctness, auditability, transactional inventory operations, security, observability, and maintainability matter more than distributed-system complexity.

## Reference UI

The two supplied dashboard screenshots are the visual reference for:
- dark navy left navigation
- clean light workspace
- blue/indigo primary actions
- KPI cards
- inventory tables with filters, pagination, status badges, and row actions
- sales/inventory charts
- recent activity
- expiry/low-stock visibility
- responsive behavior

Do not copy sample data from the screenshots into production.

## Recommended stack

- Web: Next.js 16+, React 19+, TypeScript, Tailwind CSS
- API: NestJS, TypeScript
- Database: PostgreSQL 16+
- ORM: Prisma
- Cache / queues / rate limiting: Redis
- Background jobs: BullMQ
- File storage: S3-compatible object storage
- Auth: secure HTTP-only cookie session or short-lived access token + rotating refresh token
- Validation: Zod on web boundaries, DTO/class-validator or Zod-compatible validation on API boundaries
- Tests: Vitest/Jest + Playwright
- Containers: Docker
- CI/CD: GitHub Actions
- Observability: structured logs + OpenTelemetry-compatible tracing + error tracking
- Deployment: managed PostgreSQL + Redis + containerized web/API

## Non-negotiable product properties

1. Never lose or silently overwrite stock.
2. Every stock-changing action is transactional.
3. Every important mutation is auditable.
4. Permissions are enforced server-side.
5. Money is stored as integer minor units or exact decimal values, never floating point.
6. Quantities use decimal-safe representations where units can be fractional.
7. Client-side state is never treated as the source of truth for authorization or stock.
8. Destructive operations require explicit confirmation and are logged.
9. APIs are versioned and validated at their boundaries.
10. Database constraints protect invariants even if application code has a bug.

## First implementation milestone

Build in this order:

1. authentication + organizations/tenant boundary
2. users/roles/permissions
3. warehouses
4. products, categories, brands, units
5. stock balance + immutable stock ledger
6. stock adjustments
7. stock transfers
8. suppliers + purchase orders + receiving
9. customers + sales/POS
10. returns
11. batches/lots + expiry
12. notifications
13. reports
14. audit log
15. dashboards
16. integrations/import/export

Avoid building the dashboard first and leaving the domain model for later.

## Repository

```text
.
├── apps/
│   ├── web/                 # Next.js application
│   └── api/                 # NestJS API
├── packages/
│   ├── ui/                  # Shared UI primitives
│   ├── config/              # Shared lint/TS/config conventions
│   └── types/               # Shared stable contracts only
├── docs/
│   ├── architecture.md
│   ├── product-requirements.md
│   ├── database.md
│   ├── api.md
│   ├── security.md
│   ├── testing.md
│   ├── deployment.md
│   ├── observability.md
│   ├── ui.md
│   └── adr/
├── infra/                   # Docker, deployment and operational config
├── .claude/
│   └── skills/
└── CLAUDE.md
```

See `CLAUDE.md` before making changes.
