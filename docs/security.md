# Security

## Threat model

Protect:

- user accounts;
- inventory and pricing;
- customer/supplier information;
- uploaded files;
- financial records;
- audit history;
- integration credentials.

Assume a malicious authenticated user may attempt horizontal privilege escalation.

## Authentication

Recommended:

- secure HTTP-only session cookies for browser apps;
- short session lifetime with controlled renewal;
- logout invalidates the session;
- password hashes use a modern password hashing algorithm such as Argon2id;
- MFA can be added for privileged roles.

Never store plaintext passwords.

## Authorization

Use RBAC plus resource/organization scoping.

Bad:

```ts
if (user.role === "ADMIN") ...
```

Preferred:

```text
requirePermission("inventory.adjust")
```

Then enforce organization/resource scope.

## IDOR protection

This is mandatory:

```text
GET /products/:id
```

must not simply fetch by `id`.

It must ensure:

```text
product.organizationId == actor.organizationId
```

and the actor has `product.read`.

Similarly:

```text
GET /warehouses/:id
```

must verify:

```text
warehouse.organizationId == actor.organizationId
```

and require `warehouse.read`. Mutations require granular tokens `warehouse.create`, `warehouse.update`, and `warehouse.delete`.

## CSRF

If using cookie authentication:

- SameSite cookies;
- CSRF strategy appropriate to the deployment;
- do not assume CORS alone prevents CSRF.

## Rate limiting

At minimum:

- login;
- password reset;
- OTP endpoints if present;
- global search;
- exports;
- file uploads;
- expensive reports;
- public webhooks.

Use Redis-backed rate limiting when running multiple API instances.

## Input validation

Validate:

- type;
- length;
- allowed enum;
- numeric range;
- identifiers;
- file type/size;
- business state.

Reject unknown fields where appropriate.

## File uploads

- allowlist MIME types/extensions;
- enforce maximum size;
- generate server-side object keys;
- never use user filenames as storage paths;
- scan files if business risk requires it;
- serve through controlled URLs;
- do not execute uploaded files.

## Secrets

Use environment variables or a secrets manager.

Never:

- commit `.env`;
- put API keys in frontend bundles;
- print secrets in logs;
- return credentials from debug endpoints.

## Logging

Redact:

- authorization headers;
- cookies;
- passwords;
- refresh tokens;
- API keys;
- sensitive customer fields.

## Security headers

Configure:

- Content-Security-Policy where compatible;
- HSTS in production;
- X-Content-Type-Options;
- Referrer-Policy;
- frame protections;
- restrictive permissions policy where appropriate.

## Dependency security

CI should run:

- package audit;
- dependency update checks;
- secret scanning;
- static analysis.

Pin/lock dependency versions.

## Database security

Production DB:

- private network where possible;
- least-privilege application account;
- separate migration credentials if practical;
- encrypted connections;
- backups encrypted at rest.

## Audit

Audit:

- login/security events;
- user/role changes;
- product changes affecting price/SKU;
- stock adjustments;
- transfers;
- receiving;
- sales cancellation;
- returns;
- exports;
- settings changes.

Audit events are append-only.

## Security acceptance criteria

Before production:

- authorization tests exist;
- tenant isolation is tested;
- IDOR tests exist;
- rate limits are verified;
- file upload restrictions are tested;
- secrets are absent from source/build artifacts;
- dependency vulnerabilities are reviewed;
- backup restore is tested.

## Phase 2A Architecture Implementation Details

- **Authentication**: Hybrid Cookie/JWT strategy. Short-lived (15m) access token and long-lived (7d) refresh token stored as HttpOnly, Secure, SameSite=strict cookies. Tokens are NEVER exposed to JS via JSON responses or localStorage.
- **Tenant Isolation**: Strictly enforced by `OrganizationGuard`. Requires `x-organization-id` header AND validates active membership within PostgreSQL before assigning `request.activeOrganization`.
- **Argon2 Hardening**: Uses argon2id variant, memoryCost 64MB, timeCost 3 iterations, parallelism 4.
- **Audit Sanitization**: Audit logs scrub sensitive keys like `password`, `token`, `secret`, `cookie`, `database_url` before database insertion.

## Phase 2B Security Enhancements — Core Domain Foundation

- **IDOR Protection at Query Level**:
  - Direct database queries for tenant-owned resources MUST apply `TenantQueryHelper.scopeToOrg` or verify via `TenantQueryHelper.assertTenantOwnership`.
  - When a requested ID exists under a different tenant, `assertTenantOwnership` throws `EntityNotFoundException` (HTTP 404). This eliminates IDOR vulnerability without exposing entity existence across tenant boundaries.
- **Database Error Masking & Information Leakage Prevention**:
  - Prisma errors are intercepted by `AllExceptionsFilter` before reaching the client:
    - `P2002` (Unique constraint): Transformed to HTTP 409 `DUPLICATE_RESOURCE`. Index names, column names, and conflicting values are stripped from the response.
    - `P2003` (Foreign key constraint): Transformed to HTTP 400 `FOREIGN_KEY_VIOLATION`. Referenced table names and key constraints are stripped.
    - `P2025` (Record not found): Transformed to HTTP 404 `NOT_FOUND`. Internal query details are stripped.
- **Parameter & Sort Injection Prevention**:
  - `validateSortField` enforces strict whitelist validation on incoming sort fields against domain-allowed properties, preventing arbitrary column introspection or injection attacks.

## Phase 3A Security Enhancements — Category Foundation

- **Tenant Isolation & IDOR Protection**:
  - Every Category lookup, creation, update, and deletion is scoped by `organizationId`.
  - In `OrganizationGuard`, route context parsing differentiates between organization endpoints (`/organizations/:id`) and resource routes (`/categories/:id`), preventing false-positive context mismatches while strictly enforcing active tenant membership.
  - Cross-tenant category requests (e.g., accessing an Org B category ID with Org A context) yield a generic `404 Not Found` (`CATEGORY_NOT_FOUND`) to prevent enumeration or leaking the existence of other tenants' data.
- **Granular Category Permissions**:
  - Enforced server-side via `@RequirePermissions(...)` with `PermissionsGuard`:
    - `category.read`: View category listings or individual details.
    - `category.create`: Add new categories to the active organization.
    - `category.update`: Edit category attributes.
    - `category.delete`: Remove unreferenced categories.
- **Payload & Injection Boundaries**:
  - `CreateCategoryDto` and `UpdateCategoryDto` utilize class-validator with `whitelist: true` and `forbidNonWhitelisted: true`.
  - Attempts to supply `organizationId`, `id`, or unknown fields are rejected with HTTP 400.
  - Category IDs in path parameters are strictly validated as UUIDv4 using `ParseUUIDPipe`.
- **Audit Sanitization**:
  - Category creation, update, and deletion mutations trigger immutable records in `AuditEvent` with sanitized metadata and correlation `requestId`.

## Phase 3B Security Enhancements — Product Domain Foundation

- **Database Engine-Level Cross-Tenant Protection (Defense-in-Depth)**:
  - Instead of relying solely on application-level checks, Phase 3B establishes a composite foreign key on `Product`:
    `FOREIGN KEY ("organizationId", "categoryId") REFERENCES "Category"("organizationId", "id") ON DELETE RESTRICT`.
  - This guarantees that PostgreSQL will reject any attempt to reference a category outside the product's active organization with constraint violation `Product_organizationId_categoryId_fkey` (`P2003`), providing physical defense-in-depth against IDOR and cross-tenant category linking.
- **Tenant-Isolated SKU Namespace**:
  - Uniqueness constraint `@@unique([organizationId, sku])` isolates the SKU namespace strictly per tenant.
  - Organization A and Organization B can each create a product with SKU `BOLT-100` without collision or tenant interference.
  - Within an organization, duplicate SKUs are strictly blocked by uppercase normalization and unique constraints.
- **Scoped Lookups & IDOR Immunity**:
  - Domain queries (`findById`, `findBySku`, `updateStatus`) explicitly scope by `organizationId`. Lookups across tenant boundaries return `null` or throw `ProductNotFoundException` (HTTP 404), preventing resource enumeration.
- **Referential Protection against Orphaned Inventory (`ON DELETE RESTRICT`)**:
  - Categories referenced by products cannot be deleted. Deletion attempts fail safely with referential integrity constraints, preventing accidental cascade deletion of active product catalog hierarchies.
- **Audit Logging**:
  - Product creation and lifecycle status changes emit immutable records in `AuditEvent` capturing actor ID, tenant ID, previous status, new status, and correlation `requestId`.

## Phase 3C Security Enhancements — Product API Implementation

- **Strict Server-Side RBAC Enforcement**:
  - Granular permissions enforced on all endpoints via `@RequirePermissions(...)` + `PermissionsGuard`:
    - `POST /api/v1/products` -> `product.create`
    - `GET /api/v1/products`, `GET /api/v1/products/:id`, `GET /api/v1/products/sku/:sku` -> `product.read`
    - `PATCH /api/v1/products/:id` -> `product.update`
    - `DELETE /api/v1/products/:id` -> `product.delete`
- **IDOR Immunity on All Operations**:
  - GET, PATCH, and DELETE operations for products verify ownership within the active organization. Attempting to query, mutate, or delete a foreign tenant's product returns `404 Not Found` (`PRODUCT_NOT_FOUND`), preventing existence enumeration.
- **Tenant Context Authority (`x-organization-id`)**:
  - `x-organization-id` header is validated against active database memberships by `OrganizationGuard`. Client payloads attempting to specify `organizationId` or `id` are rejected via `whitelist: true, forbidNonWhitelisted: true`.
- **Cross-Tenant Category Protection**:
  - Creating or reassigning a product to a category belonging to another tenant is blocked at both application validation and PostgreSQL composite foreign key level (`INVALID_CATEGORY_REFERENCE`).
- **SQL Injection Safety**:
  - Search and filter queries utilize Prisma's strongly typed query builders with parameterized inputs. Special characters, quote marks, SQL operators, and wildcards are safely escaped and cannot alter the query structure.
- **Sort Allowlist Security**:
  - Sort fields are strictly validated using `validateSortField` against an allowlist (`['name', 'sku', 'createdAt', 'updatedAt', 'status', 'unitOfMeasure']`). Unrecognized fields safely fall back to `createdAt`.
- **Sensitive Data Redaction in Audit Logging**:
  - All product mutation events sanitize metadata, preventing leaking of system secrets or authentication tokens into append-only `AuditEvent` logs.

## Phase 3F Product Security Audit & Final QA Invariants

- **Authoritative Tenant Membership Validation**:
  - `OrganizationGuard` validates that the user possesses active membership within the specified `x-organization-id`. Header spoofing attempts by authenticated users against organizations they do not belong to are immediately denied with HTTP 403 `Forbidden`.
- **SKU & Query Tenant Isolation**:
  - SKU lookups (`/products/sku/:sku`) and catalog searches (`/products?search=...`) are strictly bounded by `organizationId`. A query cannot resolve, enumerate, or detect products belonging to another tenant under any search term or SKU parameter.
- **Physical Composite Foreign Key Guardrails**:
  - The PostgreSQL composite foreign key (`Product_organizationId_categoryId_fkey`) guarantees referential integrity at the database layer. Cross-tenant category associations are rejected both pre-emptively by domain validation and conclusively by the database engine (`P2003` / `INVALID_CATEGORY_REFERENCE`).
- **Concurrent Mutation & SKU Race Invariance**:
  - Uniqueness constraint `@@unique([organizationId, sku])` prevents race-condition collisions during concurrent product creation. Simultaneous insertion attempts resolve deterministically, with exactly one winning insert and losing inserts caught cleanly and mapped to HTTP 409 `PRODUCT_DUPLICATE_SKU`.
- **Audit Sanitization Protocol**:
  - All mutation audit metadata passes through `AuditService.sanitize()`. Sensitive keys including `password`, `token`, `secret`, `authorization`, `cookie`, and `database_url` are automatically redacted with `[REDACTED]` prior to persistence.
- **Frontend Boundary Hardening**:
  - Zero server/database packages (`@repo/database`, `prisma`, `pg`, `redis`) or credentials (`DATABASE_URL`, secrets) are accessible or imported in frontend bundles.
  - Authentication tokens reside solely in HTTP-only, secure, same-site cookies and are never stored in browser `localStorage`.

## Phase 5A Stock & Inventory Security Foundations

- **Engine-Level Cross-Tenant Protection via Composite Foreign Keys**:
  - `StockBalance` and `StockLedgerEntry` enforce composite foreign keys referencing `(organizationId, productId)` -> `Product(organizationId, id)` and `(organizationId, warehouseId)` -> `Warehouse(organizationId, id)`.
  - A malicious or buggy caller can never associate a Product from Organization A with a Warehouse from Organization B. The PostgreSQL constraint rejects the operation at the physical database layer.
- **Ledger Immutability & Audit Safety**:
  - The stock ledger is append-only. Application domain services provide no update or delete endpoints.
  - Actor deletion retains historical ledger records via `createdById` with `onDelete: SetNull`. Historical movement audits remain permanent.
- **Idempotency Multi-Tenant Scoping**:
  - Idempotency keys are scoped strictly per organization `@@unique([organizationId, idempotencyKey])`. Organization A and Organization B can generate identical idempotency keys without collision or cross-tenant interference.
- **Zero Endpoint Exposure in Phase 5A**:
  - Phase 5A introduces database and domain models only. No HTTP routes or controllers are exposed, preventing any unauthorized API attack surface until authenticated mutation routines are built in Phase 5B.

## Phase 5B Stock Mutation Security Guarantees

- **Authoritative Tenant Validation Prior to Mutation**:
  - `StockMutationService` explicitly verifies that Organization, Product, and Warehouse entities belong strictly to the tenant `organizationId` before entering the transaction. Cross-tenant combinations fail safely with 404 domain exceptions (`PRODUCT_NOT_FOUND`, `WAREHOUSE_NOT_FOUND`), preventing cross-tenant existence enumeration.
- **Actor Membership Boundary**:
  - Mutations specifying `actorUserId` must belong to an active `OrganizationMembership` within the target organization; external actors attempting to trigger mutations in another organization are rejected with HTTP 403 `STOCK_ACTOR_NOT_FOUND`.
- **Negative Stock Protection**:
  - Mutations attempting to drive inventory negative are strictly rejected, preventing inventory theft, unauthorized negative adjustments, or system drift.
- **Idempotency Conflict & Replay Protection**:
  - Replaying an identical request returns the cached result without duplicate execution. Reusing an idempotency key with modified payload fails with HTTP 409 `STOCK_IDEMPOTENCY_CONFLICT`, defeating replay tampering attacks.

## Phase 5C Stock REST API Security Hardening

- **Authoritative RBAC & Endpoint Defense**:
  - Read endpoints (`/balances*`, `/ledger*`) require authenticated access with `stock.read` permission.
  - Mutation endpoints (`POST /mutations`) require authenticated access with `stock.mutate` permission. Direct API calls without these permissions are denied at the guard level with HTTP 403 `Forbidden`.
- **Tenant Context Hardening & Mass Assignment Defense**:
  - Incoming payloads for mutations and queries never accept `organizationId` or `actorId` from client JSON bodies. Tenant context is derived strictly from `request.activeOrganization.id` verified by `OrganizationGuard`. Actor context is derived strictly from `@CurrentUser()` verified by `JwtAuthGuard`.
  - Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` rejects attempts to inject `organizationId`, `actorId`, `quantityBefore`, or `quantityAfter` with HTTP 400 `Bad Request`.
- **String Quantity Exact Decimal Protection**:
  - Client payloads must provide `quantityDelta` as an exact decimal string. JavaScript floating-point numbers are rejected with HTTP 400 `Bad Request`, eliminating precision loss attacks or numerical truncation vulnerabilities.
- **Header & Body Idempotency Reconciliation**:
  - Supports both `Idempotency-Key` header and body `idempotencyKey`. If both are supplied, the controller enforces exact matching; any discrepancy throws HTTP 400 `Bad Request`.
- **Cross-Tenant IDOR Sanitization**:
  - Balance detail, balance-by-product, balance-by-warehouse, and ledger detail routes enforce active tenant boundaries. Requesting IDs belonging to other organizations returns HTTP 404 `Not Found`, preventing cross-tenant resource enumeration.
- **Immutable Ledger Guarantees**:
  - There are no `PATCH`, `PUT`, or `DELETE` endpoints for ledger records. The ledger API is strictly read-only for historical auditing.

## Phase 5F Stock Security & Adversarial QA Verification

Phase 5F validates the end-to-end security, integrity, and concurrency guarantees of the Stock subsystem under adversarial conditions:

- **Adversarial Tenant Isolation & Header Spoofing**:
  - Validated across real PostgreSQL and HTTP API tests that an authenticated user in Organization A cannot access balances, ledger records, or scoped inventory in Organization B (returns 404, preventing resource enumeration).
  - Attempting to spoof `x-organization-id` with another organization's UUID is unconditionally rejected with HTTP 403 `Forbidden`.
- **IDOR & Path Sanitization**:
  - Tested random non-existent UUIDs, malformed identifiers, and path traversal attempts across `/stock/balances/:id` and `/stock/ledger/:id`. All non-existent identifiers return 404 uniformly without leaking whether another tenant possesses the resource.
- **Mass Assignment & Strict String Protocol**:
  - Proved that injecting protected or authoritative fields (`id`, `organizationId`, `quantityBefore`, `quantityAfter`, `createdAt`, `updatedAt`, `actorId`) results in immediate HTTP 400 rejection via `forbidNonWhitelisted: true`.
  - Numeric JSON values (`{ "quantityDelta": 10 }`), floating-point numbers, scale > 4, zero values, and non-numeric strings (`NaN`, `Infinity`, `1e5`) are strictly rejected.
- **Concurrency & Race Invariance (Real PostgreSQL)**:
  - 10 concurrent requests issuing `-15.0000` against stock `100.0000`: Balance remains `>= 0`, exactly 6 succeed (deducting 90.0000, leaving 10.0000), 4 fail with `StockInsufficientQuantityException`. Zero negative stock, zero lost updates.
  - 20 concurrent requests issuing `-10.0000` against stock `100.0000`: Balance reaches exactly `0.0000` with 0 lost updates.
  - First-Balance Race: 10 concurrent requests starting from zero `StockBalance` rows create exactly one row with balance `100.0000` and 10 ledger entries without constraint violations.
- **Idempotency Race & Multi-Tenant Isolation**:
  - 20 concurrent identical requests with the same idempotency key result in exactly one balance update and one ledger entry. All callers receive the identical mutation result without double deduction.
  - Same key with mismatched payload fails with HTTP 409 `STOCK_IDEMPOTENCY_CONFLICT`.
  - Same key across different organizations executes independently without collision.
- **Balance ↔ Ledger Mathematical Consistency**:
  - Verified across Opening, Receipt, Issue, and Adjustment mutations that `quantityAfter = quantityBefore + quantityDelta` holds true for every ledger row, and the sum of all deltas strictly equals the authoritative balance.
- **Zero Frontend Leakage**:
  - Verified zero imports of `@repo/database`, `@prisma/client`, `prisma`, `pg`, `postgres`, `redis`, or `ioredis` in `apps/web`.
  - Verified zero occurrences of `dangerouslySetInnerHTML` in web stock components.
