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
