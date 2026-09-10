# Non-Negotiable Engineering Rules for AI Agents

These rules are mandatory constraints. Any PR or generated code that violates any of these rules must be rejected immediately.

---

## 1. Architectural Boundaries & Authority

1. **Backend is the Business Authority**: All validation, pricing, allocation, and business state transitions must happen in `apps/api`. The frontend is merely a presentation layer.
2. **Zero Direct Frontend-to-Database Access**: `apps/web` must never connect to PostgreSQL, import Prisma, or depend upon `packages/database`.
3. **No Business Logic in React Components**: Components render state and dispatch user intents. Calculation of availability, pricing, or tax logic in UI code is forbidden.
4. **No Business Logic in NestJS Controllers**: Controllers only handle HTTP transport concerns (extract parameters, validate DTOs, invoke application services, format responses).
5. **Domain & Application Services Own Business Rules**: Application use cases orchestrate transactions and invoke domain services that enforce invariants.
6. **Historical Monolith is Deprecated**: The previous single Next.js codebase in git history is historical only. Do not port or reference its monolithic patterns, direct Prisma routes, or unconstrained stock models.

---

## 2. Multi-Tenancy & Authorization

7. **Mandatory Tenant Isolation**: Every tenant-owned database entity must possess an `organizationId` column.
8. **IDOR Prevention on Every Query**: Never retrieve or mutate a record by `id` alone. Enforce `resource.organizationId === actor.organizationId` server-side on every request.
9. **Permission-Based Authorization**: Authorize via granular permission tokens (e.g. `inventory.adjust`, `purchasing.approve`). Never hardcode role name strings in business logic.
10. **Frontend is Never Trusted**: Hiding a button in the UI provides zero security. Every endpoint must be guarded by server-side authentication and authorization guards.

---

## 3. Inventory Correctness & Invariants

11. **PostgreSQL is the Sole Source of Truth**: Redis, memory caches, or external tools are never authoritative for stock levels or financial transactions.
12. **Stock Mutations Must Be Transactional**: Every balance update must occur within a PostgreSQL transaction holding a pessimistic row-level lock (`SELECT ... FOR UPDATE`).
13. **Immutable, Append-Only Stock Ledger**: `StockLedgerEntry` rows must never be updated or deleted. Historical mistakes are rectified only by creating reversing ledger entries.
14. **Dual-Model Synchronization**: `StockBalance` and `StockLedgerEntry` must be updated together in the same atomic database transaction.
15. **Stock Invariant Equation**: Available stock is strictly defined as `available = on_hand - reserved`. Available stock cannot drop below zero unless a documented backorder policy is explicitly configured.
16. **No Absolute Overwrites**: Never set `balance = new_value` directly. Always apply an explicit delta (`balance = balance + delta`) tied to an auditable event.

---

## 4. Financial & Quantity Data Integrity

17. **Money Representation**: Store currency as integer minor units (e.g., cents, paise) or PostgreSQL `numeric`. Never use IEEE-754 floating point numbers (`Float` / JavaScript `number`).
18. **Quantity Precision**: Store quantities with decimal-safe precision to correctly represent fractional units of measure (e.g., kilograms, meters, liters).

---

## 5. Reliability, Idempotency & Auditing

19. **Idempotency on Mutations**: All state-changing endpoints (stock adjustments, receiving, order placement, transfers) must support `Idempotency-Key` headers to prevent duplicate operations during network retries.
20. **Immutable Audit Events**: Security events and significant business changes must be recorded in an append-only `AuditEvent` table. Application logs cannot substitute for audit records.
21. **Bounded Queries Only**: Never execute unbounded queries. All collection endpoints must enforce server-side pagination with maximum limits.

---

## 6. Code Quality & Error Handling

22. **Strict TypeScript**: Never use `any` to bypass TypeScript type safety. Use strict types, generics, or `unknown` with validation.
23. **No Silent Error Swallowing**: Empty `catch {}` blocks are strictly prohibited. Errors must be logged with correlation context and mapped to standard API error envelopes.
24. **No Internal Leakage**: Stack traces, raw SQL queries, and internal database error messages must never be returned to clients in production.
25. **No Speculative Microservices**: Maintain the modular monolith design. Do not split packages into separate microservices or message brokers without an accepted ADR.
