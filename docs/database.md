# Database Design

## Principles

PostgreSQL is authoritative. Prisma is the default access layer.

Use normalized tables for transactional data. Add read models/materialized views only when measured reporting performance requires them.

## Database Package Architecture (Phase 1D Foundation)

The authoritative database package is `packages/database`.

- **Package Ownership**: Owns `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`, `PrismaService`, and `PrismaModule`.
- **Consumer Boundaries**:
  - `apps/api`: The only application package authorized to consume `@repo/database`.
  - `apps/web`: **Strictly forbidden** from importing `@repo/database` (enforced via ESLint in `packages/config/eslint.web.mjs`). All web access to database records must flow through HTTP/JSON endpoints.
- **Canonical Connection**: `DATABASE_URL` (development default: `postgresql://postgres:postgres@localhost:5436/inventory_dev?schema=public`).
- **Prisma Client Lifecycle**: Singleton `PrismaService` managed by NestJS `OnModuleInit` (`$connect`) and `OnModuleDestroy` (`$disconnect`) via `@Global() PrismaModule`. Eliminates per-request connection churn and prevents leaks.
- **Migration Commands**:
  - Development: `pnpm --filter @repo/database prisma:migrate` (`prisma migrate dev`)
  - Production/CI: `pnpm --filter @repo/database prisma:migrate:deploy` (`prisma migrate deploy`)
- **Seed Command**: `pnpm --filter @repo/database prisma:seed` (`tsx prisma/seed.ts`)
- **Domain Scope Note**: At Phase 1D, the schema establishes the datasource and generator foundation with baseline migration tracking. The conceptual models documented below (StockBalance, StockLedgerEntry, etc.) will be created in their respective domain phases.

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

## Warehouse model

### Warehouse

One row per physical or logical inventory facility owned by an organization:

- `id`: UUID primary key
- `organizationId`: UUID foreign key referencing Organization (onDelete: Cascade)
- `name`: String, facility display name
- `code`: String, normalized uppercase alphanumeric identifier
- `description`: String? optional overview/details
- `addressLine1`: String?
- `addressLine2`: String?
- `city`: String?
- `state`: String?
- `postalCode`: String?
- `country`: String?
- `status`: WarehouseStatus enum (`ACTIVE`, `INACTIVE`), default `ACTIVE`
- `isDefault`: Boolean, default `false` (at most one default per organization)
- `createdAt`, `updatedAt`: Timestamps

#### Invariants & Constraints:

- `(organizationId, code)` UNIQUE: code must be unique within an organization; same code can exist across different organizations.
- `(organizationId, name)` UNIQUE: name must be unique within an organization.
- `(organizationId, id)` UNIQUE: composite key establishing tenant-safe relational integrity for future stock models.
- Foreign Key: `organizationId` -> `Organization.id` with `ON DELETE CASCADE`.
- Code Normalization: whitespace trimmed, converted to uppercase alphanumeric (`^[A-Z0-9_-]+$`).
- Deletion Policy: Deleting default warehouse is prohibited (`409 Conflict`). Deletion cascades when parent Organization is deleted. Future stock balances will restrict deletion via foreign key constraints.

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

## Phase 2A Schema Updates

- Added models for Multi-tenancy and Identity: `User`, `Organization`, `OrganizationMembership`, `Role`, `Permission`, `RolePermission`, `Session`, `AuditEvent`.
- Uses UUIDs for primary keys and establishes strict relational boundaries.

## Phase 2B Core Domain Conventions

- **Organization Ownership**: All tenant-scoped entities feature `organizationId` foreign keys directly referencing `Organization.id`. Single-record lookups must always scope by `where: { id, organizationId }` to prevent tenant leaks.
- **Identifier Strategy**: All table primary keys are standard RFC 4122 UUIDv4 strings (`@id @default(uuid())`).
- **Timestamp Strategy**: Timezone-aware PostgreSQL `TIMESTAMPTZ` via Prisma `DateTime @default(now())` and `@updatedAt`.
- **Financial Minor Units**: Stored as exact integer minor units (`BigInt` / `Int`, e.g. paise / cents) or exact `DECIMAL(12, 2)`. Avoid binary floating point.
- **Inventory Quantities**: Stored as exact PostgreSQL `DECIMAL(14, 4)` to support fractional unit measurements (up to 4 decimal places) without float drift.
- **Soft Deletion Policy**: Applied only where historical/audit records link to the entity (e.g. products, suppliers). Entities have `deletedAt DateTime?`. Active filters (`where: { deletedAt: null }`) are strictly enforced. Append-only ledger or audit events are never soft-deleted.

## Phase 3A Category Foundation

- **Model**: `Category`
  - `id`: String (UUIDv4 primary key `@default(uuid())`)
  - `organizationId`: String (Foreign key referencing `Organization.id` with `onDelete: Cascade`)
  - `name`: String (Required, trimmed, max 100 characters)
  - `description`: String? (Optional, trimmed, max 500 characters)
  - `createdAt`: DateTime (`@default(now())`)
  - `updatedAt`: DateTime (`@updatedAt`)
- **Uniqueness**:
  - Composite unique constraint: `@@unique([organizationId, name])`.
  - Application-level case-insensitive duplicate validation via Prisma `mode: 'insensitive'` to prevent duplicate casing collisions (e.g. "Electronics" vs "electronics") within an organization while permitting identical names across different organizations.
- **Indexes**:
  - `@@index([organizationId])` for fast tenant-scoped queries.
  - `@@index([organizationId, createdAt])` for deterministic paginated listing.
  - `@@unique([organizationId, name])` implicitly creates a btree index on `(organizationId, name)`.
- **Deletion Policy**:
  - Hard delete with referential integrity.

## Phase 3B Product Domain & Database Foundation

- **Models**:
  - **`UnitOfMeasure` Enum**: `UNIT`, `KG`, `G`, `L`, `ML`, `M`, `CM`, `BOX`, `PACK`.
  - **`ProductStatus` Enum**: `ACTIVE`, `INACTIVE`.
  - **`Category` Model Enhancement**:
    - Added `@@unique([organizationId, id])` to enable composite foreign key referencing.
    - Added relation field: `products Product[]`.
  - **`Product` Model**:
    - `id`: String (UUIDv4 primary key `@default(uuid())`)
    - `organizationId`: String (Foreign key referencing `Organization.id` with `onDelete: Cascade`)
    - `categoryId`: String (Foreign key referencing `Category.id`)
    - `name`: String (Required, trimmed, max 200 characters)
    - `sku`: String (Required, trimmed, normalized uppercase, max 50 characters)
    - `description`: String? (Optional, trimmed, max 1000 characters)
    - `unitOfMeasure`: `UnitOfMeasure` enum (Default: `UNIT`)
    - `status`: `ProductStatus` enum (Default: `ACTIVE`)
    - `createdAt`: DateTime (`@default(now())`)
    - `updatedAt`: DateTime (`@updatedAt`)
- **Foreign Key Referential Integrity**:
  - **Organization Relation**: `fields: [organizationId], references: [id], onDelete: Cascade`.
  - **Composite Category Relation**: `fields: [organizationId, categoryId], references: [organizationId, id], onDelete: Restrict`.
    - _Cross-Tenant Protection_: Because the foreign key is composite across `(organizationId, categoryId)`, PostgreSQL engine-level constraints reject any product referencing a category belonging to a different tenant (`Product_organizationId_categoryId_fkey`).
    - _Category Deletion Protection_: `onDelete: Restrict` ensures that attempting to delete a category that contains products fails with a referential integrity violation (`P2003`).
- **Uniqueness & Indexes**:
  - `@@unique([organizationId, sku])`: Enforces SKU uniqueness strictly per organization. Different organizations can safely utilize identical SKU numbers without collisions.
  - `@@index([organizationId])`: Fast filtering for tenant-scoped operations.
  - `@@index([organizationId, categoryId])`: Optimized queries filtering products by category within a tenant.
  - `@@index([organizationId, status])`: Optimized listing by active/inactive lifecycle state.
  - `@@index([organizationId, name])`: Efficient alphabetical sorting and name-based searching.
- **Migration**:
  - Applied migration: `20260912073700_phase3b_product_foundation`.
