# ADR 0008 — Transactional Stock Mutation Engine

## Status

Accepted

## Context

Phase 5A established the database models (`StockBalance` and `StockLedgerEntry`), 4-decimal exact precision schema (`DECIMAL(14, 4)`), composite tenant-safe foreign keys, and PostgreSQL mathematical check constraints.

Phase 5B creates the transactional domain engine (`StockMutationService`) that executes stock mutations. Stock is not ordinary CRUD; stock represents a critical business invariant where lost updates, race conditions, floating-point drift, or unauthorized cross-tenant associations could corrupt physical inventory counts and financial reconciliation.

## Decision

We implement a dedicated, transactional stock mutation engine with the following guarantees:

### 1. Atomic Transaction Boundary

Every stock mutation executes inside a single PostgreSQL interactive transaction (`prisma.$transaction`):

1. Assert tenant boundaries: Organization, Product, Warehouse, and optional Actor belong to `organizationId`.
2. Safe first-balance initialization:
   ```sql
   INSERT INTO "StockBalance" ("id", "organizationId", "productId", "warehouseId", "quantity", "createdAt", "updatedAt")
   VALUES (gen_random_uuid(), $1, $2, $3, 0, NOW(), NOW())
   ON CONFLICT ("organizationId", "productId", "warehouseId") DO NOTHING;
   ```
3. Acquire exclusive row lock:
   ```sql
   SELECT id, quantity FROM "StockBalance"
   WHERE "organizationId" = $1 AND "productId" = $2 AND "warehouseId" = $3
   FOR UPDATE;
   ```
4. Read current quantity and validate mutation type semantics:
   - `OPENING`: delta > 0; allowed only when current balance is 0 and no prior ledger history exists.
   - `RECEIPT`: delta > 0.
   - `ISSUE`: delta < 0.
   - `ADJUSTMENT`: delta > 0 or < 0, strictly != 0.
5. Calculate new quantity: `newQuantity = currentQuantity + delta` via fixed-point arithmetic (`QuantityUtil`).
6. Assert non-negative invariant: `newQuantity >= 0`.
7. Update `StockBalance` with `newQuantity`.
8. Insert immutable `StockLedgerEntry`.
9. Commit transaction.
10. Post-commit: emit `AuditEvent` (`stock.mutated`).

If any step fails, the entire transaction rolls back; neither `StockBalance` nor `StockLedgerEntry` is partially committed.

### 2. Concurrency & First-Balance Race Strategy

- **Existing Balances**: `SELECT ... FOR UPDATE` locks the balance row exclusively for the duration of the transaction. Concurrent updates on the same product and warehouse block until the active transaction commits, observing the latest committed balance.
- **First-Balance Initialization Race**: If two concurrent requests attempt to mutate a nonexistent balance, both issue `INSERT ... ON CONFLICT DO NOTHING`. One transaction inserts the initial 0 balance and the other safely skips insertion. Both then request `SELECT ... FOR UPDATE`, guaranteeing serial execution without unique constraint aborts.
- **Transient Conflict Retry**: A bounded retry mechanism (up to 3 attempts with exponential jitter) retries transient PostgreSQL serialization failures (`40001`), deadlocks (`40P01`), or Prisma concurrency conflicts (`P2034`). Validation errors and business rule violations are never retried.

### 3. Negative Stock Policy

**Prohibited.**
Per project invariants in `docs/testing.md` and `docs/database.md`, physical inventory on hand cannot fall below zero. If `currentQuantity + delta < 0`, the mutation throws `StockInsufficientQuantityException` and rolls back immediately.

### 4. Idempotency & Collision Protection

- Non-null idempotency keys are unique per tenant (`@@unique([organizationId, idempotencyKey])`).
- **Idempotent Replay**: If an incoming request specifies an `idempotencyKey` that has already been committed with identical payload (`productId`, `warehouseId`, `type`, `quantityDelta`, `referenceType`, `referenceId`), the engine bypasses the mutation transaction and returns the original result.
- **Collision Detection**: If the same key is reused with differing mutation parameters, the engine rejects the request with `StockIdempotencyConflictException`.
- **Cross-Tenant Freedom**: Organizations operate isolated idempotency key namespaces; identical keys across different organizations do not collide.

### 5. Separation of Concerns

- `StockFoundationService`: Provides read queries (`getBalance`, `listBalances`, `getLedgerEntries`) and domain validation.
- `StockMutationService`: Dedicated transactional mutation domain engine.
- HTTP REST controllers and UI are strictly excluded from Phase 5B.

## Alternatives Considered

1. **Application-Level Memory Locking / Mutexes**: Rejected because node memory locks do not protect across multiple API instances.
2. **Distributed Redis Locks**: Rejected because PostgreSQL is authoritative; introducing Redis for transactional lock coordination adds failure modes and split-brain risks without benefit.
3. **Allowing Negative Stock**: Rejected because existing requirements mandate that physical on-hand stock cannot be negative.

## Consequences

- Eliminates lost updates under high concurrency.
- Enforces strict mathematical consistency across all stock mutations.
- Protects multi-tenant isolation at both database and domain layers.
- Safely prepares the domain foundation for future Stock APIs (Phase 5C).
