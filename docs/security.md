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

and the actor has `products.read`.

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
