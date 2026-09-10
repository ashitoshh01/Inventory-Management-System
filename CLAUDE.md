# CLAUDE.md — Inventory Management System

## Mission

You are working on a real-world inventory management system. Optimize for **correctness, security, auditability, maintainability, and operational reliability** before convenience.

The initial production target is approximately **100 concurrent active users**. Do not prematurely introduce microservices, event-sourcing infrastructure, or distributed complexity unless a measured requirement justifies it.

## Read these files first

For any non-trivial task:
1. `docs/ENGINEERING_RULES.md` — non-negotiable invariant rules
2. `docs/IMPLEMENTATION_ORDER.md` — authoritative phase sequence
3. `docs/DEFINITION_OF_DONE.md` — phase completion gates
4. `docs/architecture.md`
5. `docs/product-requirements.md`
6. the relevant skill under `.claude/skills/<skill_name>/SKILL.md`
7. the relevant domain/database/API document

If a task changes architecture, update or create the appropriate ADR in `docs/adr/`.

> [!NOTE]
> The previous Next.js monolithic codebase in git history (`HEAD~1`) is strictly historical. Do not use it as an implementation reference.

## Stack contract

- `apps/web`: Next.js 16.x Active LTS + React 19.x + TypeScript + Tailwind CSS
- `apps/api`: NestJS + TypeScript
- `packages/database`: PostgreSQL 16+ persistence via Prisma (consumed strictly by `apps/api` and CLI tooling; never imported by `apps/web`)
- `packages/ui`: Shared accessible UI primitives
- `packages/types`: Shared domain primitives and DTO contracts
- `packages/config`: Shared TypeScript, ESLint, and Prettier configurations
- PostgreSQL is the authoritative system of record.
- Prisma is the database access layer.
- Redis is for ephemeral/cache/queue concerns, never the authoritative stock store.
- BullMQ handles asynchronous jobs.
- S3-compatible storage handles uploaded files (MinIO locally).
- Docker is the deployment packaging boundary.

Do not replace these technologies without an approved ADR.

## Architecture rules

- Use a modular monolith.
- Organize the API by business domain, not by technical layer alone.
- Keep business rules out of controllers.
- Controllers handle transport concerns; application services coordinate use cases; domain services enforce domain rules; repositories handle persistence.
- Do not let UI components call the database.
- The browser talks to the API through typed/validated contracts.
- PostgreSQL remains the source of truth.
- Prefer boring, explicit code over clever abstractions.

## Inventory correctness rules

### Stock is money-like critical data

A stock mutation must:
1. validate actor permissions;
2. validate the product/variant, warehouse, and unit;
3. start a database transaction;
4. lock or otherwise safely serialize the affected stock balance row(s);
5. verify sufficient available stock when required;
6. write an immutable stock ledger entry;
7. update the current balance;
8. create related business records;
9. create an audit event;
10. commit atomically.

Never:
- decrement stock in the client;
- trust a client-provided current balance;
- update stock with a read-then-write race;
- delete ledger history;
- use Redis as the stock source of truth.

### Idempotency

Any endpoint that can be retried and cause a business mutation should support an idempotency key, especially:
- receive purchase order
- create sale
- stock adjustment
- transfer completion
- return
- payment capture
- webhook processing

Persist the idempotency key with the operation result.

## Security rules

- Never commit secrets.
- Never log passwords, tokens, session cookies, API keys, or sensitive personal data.
- Authorization must be server-side.
- Validate every external input.
- Use parameterized ORM queries; raw SQL requires review.
- Use secure, HTTP-only, SameSite cookies where cookie auth is selected.
- Enforce rate limits on auth, OTP, search, exports, and mutation endpoints.
- Protect against IDOR: every resource lookup must verify tenant/organization and permission scope.
- Uploads require MIME/extension/size validation and safe object-storage keys.
- Audit security-sensitive actions.

## Database rules

- Use foreign keys.
- Use unique constraints for business identifiers.
- Use check constraints for simple invariants.
- Use indexes based on actual query patterns.
- Avoid N+1 queries.
- Do not use `SELECT *` in hot paths.
- Never silently alter a migration that has reached shared/staging/production environments.
- Every migration must be backward-compatible when possible.
- Large destructive data changes must be staged and reviewed.

## API rules

- Validate input at the boundary.
- Return consistent error shapes.
- Use pagination for collections.
- Use cursor pagination for very large/high-churn feeds when appropriate.
- Never expose internal database errors to clients.
- Include request/correlation IDs in logs.
- Use explicit status codes.
- Do not leak whether sensitive records exist when authorization should hide existence.

## Frontend rules

- Use server state management/query caching for API data.
- Do not duplicate authoritative API state into global state unless necessary.
- Show loading, empty, error, and permission-denied states.
- Tables need pagination, filtering, sorting, and URL-addressable state where useful.
- Destructive actions require confirmation.
- Disable duplicate submissions while a mutation is pending.
- Optimistic updates are allowed only when rollback is safe and correctness is unaffected.
- Accessibility is a release requirement, not polish.

## Testing requirements

A change is not complete when it merely compiles.

Minimum expectations:
- unit tests for non-trivial business rules;
- integration tests for database transactions;
- authorization tests for protected endpoints;
- regression test for every fixed bug;
- E2E tests for critical flows.

Critical flows:
- login/logout
- create product
- receive stock
- stock adjustment
- transfer stock
- sell stock
- return stock
- low-stock threshold
- expiry handling
- role/permission enforcement
- audit log creation

## Performance target

Design and test for:
- ~100 concurrent active users
- normal API p95 < 500 ms
- common reads ideally < 200 ms
- mutation p95 < 750 ms excluding external providers
- dashboard initial data should load without dozens of independent requests
- exports/reports should run asynchronously for large datasets

These are engineering targets, not promises. Benchmark before tuning.

## AI/vibe-coding workflow

For every task:

### Step 1 — Understand
Identify:
- user-visible behavior;
- affected domain;
- database impact;
- API impact;
- authorization impact;
- audit impact;
- tests required;
- deployment/migration impact.

### Step 2 — Plan
Before writing code, produce a short implementation plan. For risky changes, list invariants that must remain true.

### Step 3 — Inspect
Read existing code and reuse established patterns. Do not create a second implementation of an existing capability.

### Step 4 — Implement
Make the smallest coherent change. Keep types strict. Avoid unrelated refactors.

### Step 5 — Verify
Run relevant lint/typecheck/unit/integration/E2E checks.

### Step 6 — Review
Check security, race conditions, transaction boundaries, authorization, error handling, observability, and performance.

### Step 7 — Document
Update docs/ADR/API/schema comments when behavior changed.

## Definition of done

A feature is done only if:
- behavior works;
- unauthorized users cannot perform it;
- data invariants are protected;
- errors are handled;
- audit requirements are met;
- tests exist;
- migrations are safe;
- logs/metrics are sufficient;
- UI has loading/empty/error states;
- documentation is updated.

## Never do this

- invent an API response shape without checking existing contracts;
- bypass authorization because the UI hides a button;
- mutate stock outside a transaction;
- hard-delete financial/inventory history;
- store secrets in source code;
- commit `.env`;
- add a dependency for a trivial helper;
- create microservices because they sound more scalable;
- hide errors with broad `catch {}` blocks;
- use `any` to silence TypeScript;
- make production behavior depend on mock/sample data.

## When uncertain

Prefer:
1. existing project conventions;
2. explicit domain invariants;
3. database constraints;
4. secure defaults;
5. reversible changes;
6. a documented decision.

Ask for clarification only when the ambiguity changes data correctness, security, money, legal/compliance behavior, or destructive behavior. Otherwise make the safest reasonable assumption and document it.
