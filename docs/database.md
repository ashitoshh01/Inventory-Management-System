# Database Design

## Principles

PostgreSQL is authoritative. Prisma is the default access layer.

Use normalized tables for transactional data. Add read models/materialized views only when measured reporting performance requires them.

## Money

Prefer integer minor units:

```text
amount_minor = 129900
currency = INR
```

If exact decimal business calculations are required, use PostgreSQL `numeric`, never binary floating point.

## Quantity

Do not blindly use JavaScript `number` for business-critical decimal quantities.

Define allowed precision per unit of measure and use a database representation that preserves it exactly.

## Stock model

### StockBalance

One row per:
```text
organization + warehouse + location + sku + batch(optional)
```

Conceptual fields:
- id
- organizationId
- warehouseId
- locationId
- skuId
- batchId nullable
- onHand
- reserved
- version
- createdAt
- updatedAt

Unique key must prevent duplicate balances for the same stock bucket.

### StockLedgerEntry

Immutable append-only history:
- id
- organizationId
- skuId
- warehouseId
- locationId
- batchId
- type
- quantityDelta
- referenceType
- referenceId
- actorId
- idempotencyKey
- createdAt

Examples of types:
- PURCHASE_RECEIPT
- SALE
- SALE_RETURN
- ADJUSTMENT_IN
- ADJUSTMENT_OUT
- TRANSFER_OUT
- TRANSFER_IN
- STOCK_COUNT
- RESERVATION
- RELEASE_RESERVATION

Never edit historical ledger rows to fix a mistake. Create a correcting entry.

## Concurrency strategy

For a balance mutation:

```sql
BEGIN;

SELECT *
FROM stock_balances
WHERE id = $1
FOR UPDATE;

-- validate
-- create ledger entry
-- update balance

COMMIT;
```

Prisma transaction APIs should be used in application code, with raw SQL only when the required lock/query cannot be expressed safely otherwise.

## Important constraints

Examples:
- SKU unique within organization.
- Barcode unique within organization when present.
- warehouse name unique within organization.
- non-negative quantities where appropriate.
- reserved <= on_hand unless a documented backorder model exists.
- expiry date cannot precede manufacture date.
- sale line quantity > 0.
- purchase line quantity > 0.
- transfer source != destination.
- ledger quantity delta != 0.
- immutable audit/ledger records.

## Index strategy

Expected indexes:
- `(organizationId, skuId, warehouseId)`
- `(organizationId, warehouseId, skuId)`
- `(organizationId, barcode)`
- `(organizationId, status)`
- `(organizationId, createdAt)`
- `(organizationId, expiryDate)`
- foreign-key columns used in joins

Add indexes based on actual `EXPLAIN ANALYZE` results.

Do not add an index to every column.

## Pagination

For ordinary admin tables:
- offset pagination is acceptable at modest sizes.

For high-churn or large feeds:
- cursor pagination using a stable `(createdAt, id)` ordering.

Always specify deterministic ordering.

## Soft delete

Use soft deletion for business records where history matters.

Never soft-delete immutable financial/inventory/audit history.

For products, prefer `active=false` rather than deletion if referenced by historical records.

## Migrations

Rules:
1. migration must be reviewed;
2. never edit an applied migration;
3. avoid long table locks;
4. add nullable columns before backfilling;
5. backfill in batches;
6. add constraints after data is clean when needed;
7. deploy application compatibility before removing old schema.

## Backups

Production database:
- automated daily backups at minimum;
- point-in-time recovery if supported by the provider;
- retention policy defined by business requirements;
- restore drill performed periodically.

A backup that has never been restored is not a verified backup.
