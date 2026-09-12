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
