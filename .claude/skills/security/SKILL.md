---
name: security
description: Authentication, authorization, IDOR protection, input sanitization, rate limiting, and secret hygiene.
---

# Purpose

Governs defensive security measures, identity management, access control, multi-tenant isolation, and threat mitigation across the application.

# When To Use

- When implementing or modifying authentication, authorization guards, password hashing, or token handling.
- When creating endpoints accessing tenant-scoped data.
- When configuring rate limiters, security headers, cookie policies, or file uploads.

# Responsibilities

- Protect user accounts, tenant boundaries, inventory quantities, and pricing data from unauthorized access.
- Prevent Horizontal Privilege Escalation (IDOR) and Vertical Privilege Escalation.
- Ensure compliance with secure storage, secret isolation, and audit logging standards.

# Rules

1. **Password Hashing**: Must use **Argon2id** with secure work factors. Never use MD5, SHA-256, or plain text.
2. **Server-Side Authorization**: Enforce permissions on the backend using fine-grained tokens (e.g. `inventory.adjust`, `purchasing.approve`). Client-side button hiding is purely cosmetic.
3. **IDOR Prevention (Mandatory)**: Every database lookup for a tenant resource must verify:
   ```text
   resource.organizationId === actor.organizationId
   ```
   Do not trust path parameters or query parameters alone.
4. **Session Security**: Session cookies must be `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`), and invalidated upon logout.
5. **Rate Limiting**: Protect authentication endpoints (login, password reset), mutation routes, global search, and file uploads using Redis-backed rate limiting.
6. **File Upload Security**: Validate MIME types, inspect file extensions against an allowlist, enforce size caps, and generate random server-side object keys. Never use user-supplied filenames directly.
7. **Secrets Hygiene**: Never commit `.env` files, API keys, or certificates to version control. Never log passwords, tokens, or personal identifiers.

# Required Checks

- [ ] Confirm no endpoint allows cross-tenant data leakage by testing with disparate `organizationId` contexts.
- [ ] Verify that password hashes use Argon2id and passwords are excluded from all query outputs (`select: { passwordHash: false }`).
- [ ] Check that security headers (Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options) are enabled via Helmet.
- [ ] Ensure sensitive fields are masked in application logs and OpenTelemetry traces.
- [ ] Verify that rate limiting triggers HTTP 429 when abuse thresholds are exceeded.

# Common Mistakes

- Relying on UI role checks instead of backend permission guards.
- Querying a record by `id` without verifying `organizationId`.
- Committing `.env` or hardcoding secrets in test files or configs.
- Logging full HTTP request bodies containing credentials or payment details.

# Definition Of Done

- Automated authorization tests prove unauthorized and cross-tenant requests receive 403 Forbidden.
- IDOR vulnerability tests verify cross-organization queries fail.
- All secrets are managed via environment variables.
- Security audit passes with zero critical or high vulnerabilities.
