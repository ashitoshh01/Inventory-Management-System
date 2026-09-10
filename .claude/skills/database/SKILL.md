---
name: database
description: PostgreSQL modeling, Prisma schema management, migration safety, and transaction isolation rules.
---

# Purpose

Governs data modeling, schema evolution, Prisma configuration, indexing strategies, and relational invariants in PostgreSQL.

# When To Use

- When modifying `packages/database` (Prisma schema, migrations, seed data).
- When designing new entities, relationships, indexes, or constraints.
- When writing raw SQL queries or tuning query performance.

# Responsibilities

- Ensure PostgreSQL remains the authoritative, tamper-proof system of record.
- Enforce relational integrity using foreign keys, check constraints, unique indexes, and non-nullable fields.
- Safeguard the dual inventory model: current `StockBalance` + immutable append-only `StockLedgerEntry`.
- Protect data safety during schema migrations and prevent breaking changes in production.

# Rules

1. **Immutable Inventory Ledger**: Historical rows in `StockLedgerEntry` must never be updated or deleted. Corrections must be append-only opposite transactions.
2. **Currency Precision**: Money must be stored as integer minor units (e.g. cents/paise) or exact PostgreSQL `numeric`. Never use IEEE-754 floating point numbers (`Float`).
3. **Quantity Precision**: Quantities must use exact decimal representations to support fractional units of measure (e.g. kg, liters).
4. **Tenant Isolation Column**: Every tenant-owned table must include an `organizationId` foreign key and compound indexes with `organizationId`.
5. **Deterministic Locking**: In multi-row balance updates (such as transfers), balance records must be locked in a deterministic order (e.g. sorted by ID) to eliminate deadlocks.
6. **Zero Destructive Migrations**: Never modify an existing applied migration file. Add backward-compatible additive migrations.
7. **No N+1 Queries**: Explicitly include or batch relations with DataLoader or Prisma `include`/`select`. Hot paths must avoid `SELECT *`.

# Required Checks

- [ ] Ensure compound unique constraints exist for composite keys (e.g., `(organizationId, sku)`, `(organizationId, warehouseId, locationId, skuId, batchId)`).
- [ ] Check that proper indexes exist for filtering, sorting, and foreign keys.
- [ ] Confirm that check constraints protect business invariants (e.g., quantity > 0, available >= 0).
- [ ] Verify that new migrations apply cleanly forwards and backwards where feasible.
- [ ] Check query execution plans (`EXPLAIN ANALYZE`) for high-frequency queries.

# Common Mistakes

- Modifying stock levels directly without writing a corresponding ledger row.
- Storing currency or inventory quantities in `Float` fields.
- Omitting `organizationId` on sub-entities and relying on client-side routing context.
- Running unbounded queries without `limit`/`take` or pagination.

# Definition Of Done

- Prisma schema is validated and generates type-safe client without errors.
- Migrations are tested, idempotent, and non-destructive.
- Seed data runs deterministically.
- Concurrency and transaction isolation tests verify lock integrity.
