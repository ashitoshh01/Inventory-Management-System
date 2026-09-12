# ADR 0007 — Stock Balance and Immutable Ledger Architecture

## Status

Accepted

## Context

Stock management represents the authoritative core of an inventory management system. Unlike ordinary CRUD entities (e.g. settings or notes), inventory quantities represent high-stakes business and financial invariants. In a multi-tenant SaaS environment, inventory mutations must be strictly tenant-isolated, auditable, mathematically consistent, concurrency-safe, and free from binary floating-point representation drift.

Phase 5A establishes the database and domain foundation for stock and inventory.

## Decision

We establish a dual-model inventory architecture:

```text
Product (Org A)           Warehouse (Org A)
      │                         │
      ├────────────┬────────────┤
      ▼                         ▼
StockBalance (Current)     StockLedgerEntry (History)
```

### 1. Dual-Model Inventory Representation

- **`StockBalance` (Current State)**:
  - High-performance, indexed read model representing the authoritative current on-hand quantity per `(organizationId, productId, warehouseId)`.
  - Enforced by a database-level unique constraint on `(organizationId, productId, warehouseId)`. Exactly one balance row exists per product per warehouse within an organization.
  - Updated transactionally alongside each ledger entry creation.

- **`StockLedgerEntry` (Immutable History)**:
  - Append-only financial-grade movement log capturing every inventory mutation.
  - Stores `quantityBefore`, `quantityDelta`, and `quantityAfter`.
  - Captures reason/type via `StockLedgerEntryType` (`OPENING`, `RECEIPT`, `ISSUE`, `ADJUSTMENT`), source references (`referenceType`, `referenceId`), creator attribution (`createdById`), metadata (`metadata`), and optional idempotency key (`idempotencyKey`).
  - Strict append-only rule: ledger entries are never modified or deleted once created. Historical corrections must be effected through new compensating ledger entries.

### 2. Exact Quantity Representation & Scale

- Inventory quantities are strictly prohibited from using binary floating-point types (`float`, `double`, JavaScript `number` arithmetic).
- Persisted as PostgreSQL `DECIMAL(14, 4)` via Prisma `@db.Decimal(14, 4)`.
- Precision: Up to 4 decimal places (scale = 4).
  - Minimum representable fractional unit: `0.0001`.
  - Quantities exceeding 4 decimal places (e.g. `0.00001`) are rejected at the domain boundary via `StockQuantityValidator`.
  - Supports non-negative and negative ledger deltas with fixed-point string arithmetic via `QuantityUtil`.

### 3. Tenant-Safe Composite Foreign Keys

To prevent cross-tenant corruption (e.g. pairing Product from Organization A with Warehouse from Organization B), database-level composite foreign keys are enforced:

- `Product` has `@@unique([organizationId, id])`.
- `Warehouse` has `@@unique([organizationId, id])`.
- `StockBalance` references `Product` via `[organizationId, productId] -> Product[organizationId, id]` (`onDelete: Restrict`).
- `StockBalance` references `Warehouse` via `[organizationId, warehouseId] -> Warehouse[organizationId, id]` (`onDelete: Restrict`).
- `StockLedgerEntry` references `Product` via `[organizationId, productId] -> Product[organizationId, id]` (`onDelete: Restrict`).
- `StockLedgerEntry` references `Warehouse` via `[organizationId, warehouseId] -> Warehouse[organizationId, id]` (`onDelete: Restrict`).
- Both models cascade on parent `Organization` deletion (`onDelete: Cascade`).

The PostgreSQL database engine itself rejects any cross-tenant combinations, ensuring data integrity regardless of application-level bugs.

### 4. Deletion Restrictions

- Products and Warehouses that have associated stock balances or ledger history cannot be deleted (`onDelete: Restrict`). Deletion attempts fail with a foreign key violation (`P2003`), preserving historical audit records.
- Actor attribution on ledger entries uses `User` with `onDelete: SetNull` so that purging user accounts does not destroy inventory history.

### 5. Mathematical Check Constraints

PostgreSQL-level check constraints guarantee arithmetic validity:

- `StockLedgerEntry_delta_nonzero`: `CHECK ("quantityDelta" <> 0)` prevents meaningless zero-quantity ledger rows.
- `StockLedgerEntry_math_consistent`: `CHECK ("quantityAfter" = "quantityBefore" + "quantityDelta")` ensures mathematical integrity across all recorded entries.

### 6. Concurrency & Transaction Strategy (Future Mutations)

In Phase 5B and beyond, every stock mutation must adhere to this transactional pattern:

```sql
BEGIN TRANSACTION;

-- 1. Lock existing StockBalance row or insert new row atomically
SELECT * FROM "StockBalance"
WHERE "organizationId" = $1 AND "productId" = $2 AND "warehouseId" = $3
FOR UPDATE;

-- 2. If row does not exist, insert initial balance (handling unique constraint races via ON CONFLICT DO NOTHING / retry)
-- 3. Calculate new quantity using fixed-point math
-- 4. Update StockBalance with new quantity
-- 5. Insert immutable StockLedgerEntry
COMMIT;
```

### 7. Ledger Immutability

Enforced architecturally in Phase 5A:

- `StockFoundationService` provides read and append operations only (`recordLedgerEntry`, `getBalance`, `listBalances`, `getLedgerEntries`).
- No `update` or `delete` methods exist on `StockLedgerEntry`.

### 8. Negative Stock Policy

**Negative stock policy is not finalized in Phase 5A.**
Requirements for normal inventory prohibit negative on-hand balance, but backorder policies or negative adjustments remain open for configuration. Consequently, no database-level `CHECK (quantity >= 0)` is applied to `StockBalance` in Phase 5A. Future mutation services will enforce this policy at the domain/service layer.

### 9. Idempotency Foundation

`StockLedgerEntry` introduces `@@unique([organizationId, idempotencyKey])`:

- Unique per organization when non-null, preventing duplicate mutations upon retries.
- Allows multiple rows where `idempotencyKey IS NULL`.
- Allows identical idempotency keys across different organizations without collision.

## Alternatives Considered

1. **Ledger-Only Storage**: Derive current stock balance by running `SUM(quantityDelta)` on every read. Rejected because read latency degrades as ledger size scales into millions of rows.
2. **Balance-Only Storage (CRUD)**: Update a single `quantity` column without a movement ledger. Rejected because it destroys auditability, reconciliation capability, and chronological traceability.
3. **Database Triggers for Immutability**: Installing PL/pgSQL triggers to abort `UPDATE` and `DELETE` queries on `StockLedgerEntry`. Rejected in Phase 5A to avoid unmanaged database trigger side-effects and deployment friction; immutability is strictly enforced architecturally.

## Consequences

- Prevents cross-tenant inventory pairing at the database engine level.
- Eliminates floating-point rounding errors across inventory reporting.
- Guarantees complete chronological audit trails of stock changes.
- Prepares the database schema safely for transactional mutation workflows in Phase 5B.
