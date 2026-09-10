---
name: backend
description: Architecture, dependency injection, and business orchestration rules for the NestJS API application.
---

# Purpose
Governs the architecture, domain logic encapsulation, transaction boundaries, and transport handling of the NestJS application in `apps/api`.

# When To Use
- When creating or modifying NestJS controllers, services, modules, guards, or interceptors.
- When orchestrating transactions, mutations, or background jobs.
- When integrating the API with PostgreSQL via Prisma or with Redis/BullMQ.

# Responsibilities
- Serve as the authoritative engine for all business logic, validation, authorization, and inventory mutations.
- Enforce clean separation of concerns: thin controllers, application services orchestrating workflows, domain services executing invariant rules, and repositories handling persistence.
- Manage atomic database transactions and row-level serialization for state mutations.
- Ensure strict multi-tenant isolation on all database queries.

# Rules
1. **No Business Logic in Controllers**: Controllers are strictly for transport handling: input extraction, DTO mapping, status codes, and HTTP headers.
2. **Atomic Inventory Transactions**: Any operation altering stock balances must execute inside an explicit database transaction with row-level locks (`SELECT ... FOR UPDATE`).
3. **Idempotency on Mutations**: All state-changing endpoints must support and enforce `Idempotency-Key` headers via middleware or guards.
4. **Tenant Context Enforcement**: Every query must verify `organizationId` matching the authenticated user's organization.
5. **Standardized Response Envelope**: Return responses wrapped in `{ data, meta }` and errors in `{ error: { code, message, requestId } }`.
6. **No Stack Traces in Production**: Sanitize and map all internal errors; never leak database or Prisma error details to the client.
7. **Boring, Explicit Code**: Avoid overly dynamic magic or deep inheritance trees; prefer explicit dependency injection.

# Required Checks
- [ ] Ensure the controller endpoint is protected by appropriate authentication and permission guards.
- [ ] Confirm that input DTOs are validated using class-validator or Zod pipes.
- [ ] Verify that transactions wrap ledger and balance mutations atomically.
- [ ] Check that `organizationId` is passed down and scoped in every repository call.
- [ ] Ensure request/correlation ID is attached to logs and response headers.

# Common Mistakes
- Writing business algorithms or direct database queries inside controller methods.
- Updating stock balance without writing an immutable ledger entry.
- Performing reads before writes without acquiring a row-level lock, causing race conditions.
- Catching exceptions broadly without rethrowing or properly formatting error envelopes.

# Definition Of Done
- Endpoints are strictly typed, documented, and protected by authentication and permission guards.
- Transactional integrity is covered by integration tests against real PostgreSQL.
- Idempotency is verified for retried mutation requests.
- No internal errors or stack traces leak to the client.
