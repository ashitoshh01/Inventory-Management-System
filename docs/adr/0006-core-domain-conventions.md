# ADR 0006: Core Domain Conventions & Tenancy Architecture

## Status

Accepted

## Context

As the Inventory Management System transitions from foundational identity/auth (Phase 2A) to core domain foundations (Phase 2B) and subsequent business domains, standard architectural and database conventions are required across all modules to ensure tenant isolation, data consistency, financial precision, and observable API boundaries.

## Decisions

### 1. Identifier Strategy

- **Format**: All database entities and public API identifiers use RFC 4122 UUIDv4 strings.
- **Validation**: Entity IDs are validated at API boundaries via NestJS pipes / `class-validator` (`@IsUUID()`). Malformed IDs fail immediately with HTTP 400 or controlled 404 envelopes, preventing internal database query errors.

### 2. Timestamp Convention

- **Database**: Timezone-aware timestamps (`DateTime @default(now())`, `@updatedAt` mapping to PostgreSQL `TIMESTAMPTZ`).
- **API Serialized Format**: Strict ISO 8601 UTC strings (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- **No Arbitrary Strings**: Timestamps must never be stored or manipulated as unparsed or arbitrary strings.

### 3. Tenant Ownership & Query Scoping

- **Organization Ownership**: All business domain entities belong directly to an `Organization` via `organizationId`.
- **Query Scoping**: Single-record lookups for organization-owned resources must never query by `id` alone. Lookups must use composite scoping:
  ```typescript
  prisma.domainEntity.findFirst({
    where: { id, organizationId },
  });
  ```
- **IDOR / Existence Protection**: If a client requests a resource belonging to a different tenant, the API must return a safe `404 Not Found` (or reject context with `403 Forbidden` if headers mismatch), never confirming or leaking whether the resource exists in another organization.

### 4. Financial & Monetary Values

- **Floating-Point Ban**: Binary floating-point numbers (`number` / `FLOAT`) are strictly prohibited for monetary calculations and storage.
- **Representation**: Financial values are stored as integer minor units (`BigInt` / `Int`, e.g. 12550 paise = ₹125.50) or exact PostgreSQL `DECIMAL(12, 2)`.
- **API Contracts**: Minor units are serialized as strings or formatted objects (`MoneyValue`) to prevent JavaScript 64-bit integer overflow.

### 5. Fractional Inventory Quantities

- **Representation**: Inventory quantities support fractional quantities (e.g. 1.5000 kg, 0.2500 L) up to 4 decimal places using exact PostgreSQL `DECIMAL(14, 4)` and string-based fixed-point arithmetic (`QuantityUtil`).

### 6. Soft Delete Policy

- **Selective Application**: Soft deletion is **NOT** added universally to every table. It is applied only to master records or entities requiring historical/audit preservation.
- **Integrity**: Soft-deleted entities retain foreign key integrity and are clearly distinguished via `deletedAt DateTime?`. Active filters (`where: { deletedAt: null }`) are applied consistently in domain queries.

### 7. Pagination & Safe Sorting

- **Pagination Standard**: Default offset pagination with `page` (default 1), `limit` (default 20, max 100).
- **Sort Allowlists**: Sort fields must strictly validate against domain-defined allowlists (`validateSortField`) to completely prevent column name injection or unindexed database scans.

## Consequences

- Prevents cross-tenant data leaks and IDOR vulnerabilities.
- Guarantees financial and inventory precision across all future modules.
- Enforces predictable API contracts and error envelopes across the modular monolith.
