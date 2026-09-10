# Architecture

## Decision

Use a **decoupled modular monolith** with separate web (`apps/web`) and API (`apps/api`) applications inside a pnpm/Turborepo monorepo.

- **Frontend**: Next.js 16.x Active LTS + React 19.x
- **Backend**: NestJS
- **Shared Packages**:
  - `packages/database`: PostgreSQL 16+ access layer via Prisma (consumed exclusively by `apps/api` and migration tooling; never imported by `apps/web`)
  - `packages/ui`: Shared accessible UI primitives
  - `packages/types`: Shared domain primitives and DTO contracts
  - `packages/config`: Shared TypeScript, ESLint, and Prettier configurations

```text
Browser
   │
   ▼
Next.js 16 Web (apps/web)
   │ HTTPS / JSON
   ▼
NestJS API (apps/api)
   ├── Auth & Users
   ├── Catalog
   ├── Warehouses
   ├── Inventory
   ├── Purchasing
   ├── Sales / POS
   ├── Returns
   ├── Suppliers
   ├── Customers
   ├── Reports
   ├── Notifications
   ├── Audit
   └── Integrations
        │
        ├── PostgreSQL  ← source of truth
        ├── Redis       ← cache/queues/rate limits
        └── S3          ← files
```

## Why not microservices?

At ~100 concurrent users, a modular monolith gives:
- one transaction boundary for stock operations;
- simpler deployment;
- simpler local development;
- fewer network failure modes;
- lower infrastructure cost;
- easier debugging.

Domain modules still have strict boundaries so extraction remains possible later.

## API module pattern

```text
modules/inventory/
├── inventory.module.ts
├── controllers/
├── application/
│   ├── commands/
│   └── queries/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   └── services/
├── infrastructure/
│   ├── repositories/
│   └── mappers/
└── dto/
```

Do not force every module to use every folder. Use the structure when complexity warrants it.

## Request flow

```text
HTTP request
 → authentication
 → tenant/org context
 → authorization
 → input validation
 → controller
 → application use case
 → domain rules
 → repository
 → PostgreSQL transaction
 → audit event
 → response
```

## Sync vs async

Keep synchronous:
- CRUD for normal records;
- stock mutations;
- small searches;
- permission checks.

Move to background jobs:
- large CSV/XLSX import;
- large exports;
- report generation;
- email;
- notification fan-out;
- image processing;
- scheduled expiry scans;
- low-stock notification fan-out.

A job must be retry-safe.

## Scalability

For 100 concurrent users, start with:
- 2 API instances if deployment supports it;
- 1–2 web instances depending on hosting;
- managed PostgreSQL;
- managed Redis;
- object storage;
- load balancer/reverse proxy.

Scale based on metrics rather than guesses.

## Failure principles

- PostgreSQL failure: application should fail closed for mutations.
- Redis failure: core CRUD and stock correctness should continue where practical; queue-backed features may degrade.
- Object storage failure: database record should not claim a file was successfully stored.
- Email provider failure: business mutation should not roll back merely because email failed; queue/retry instead.
- External integration failure: isolate with timeouts, retries, circuit-breaking where justified.

## Multi-tenancy

If the product will serve multiple companies, model `Organization`/`Tenant` from the beginning.

Every tenant-owned table should have an `organizationId` or an unambiguous ownership path.

Authorization must verify:
```text
actor.organizationId == resource.organizationId
```

Do not rely only on route IDs.

## Transactions

Stock-changing workflows must have one explicit transaction boundary around the complete invariant-changing operation.

Example:

```text
BEGIN
  lock stock balance
  validate availability
  create ledger entry
  update balance
  create sale/transfer/adjustment record
  create audit event
COMMIT
```

## Concurrency

Avoid application-level locks unless necessary. Prefer PostgreSQL transactions and row-level locking.

For transfer:
- lock source and destination balances in deterministic ID order to reduce deadlocks;
- validate source available quantity;
- write outbound/inbound ledger records;
- update balances atomically.

For reservation:
- lock balance;
- calculate available = on_hand - reserved;
- reject if requested quantity > available;
- increment reserved.

## Caching

Safe cache candidates:
- category lists;
- brand lists;
- permissions metadata;
- dashboard aggregates with short TTL where stale values are acceptable.

Never cache mutable stock as authoritative truth.

## Observability

Every request should have:
- request ID;
- actor ID when authenticated;
- organization ID;
- route;
- status;
- duration.

Sensitive values must be redacted.

## Architecture evolution

If a module becomes independently scalable or has a distinct reliability boundary, propose an ADR before extracting it into a service.
