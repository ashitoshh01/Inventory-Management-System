---
name: api
description: REST API conventions, versioning, DTO validation, idempotency, and error formatting.
---

# Purpose
Governs the REST API contracts, path structures, pagination standards, validation mechanisms, and error envelopes across the HTTP boundary.

# When To Use
- When designing, adding, or modifying endpoints in `apps/api`.
- When defining DTOs, request validators, or response serializations.
- When configuring API middleware, interceptors, or guards.

# Responsibilities
- Provide a predictable, strictly versioned, and documented RESTful API (`/api/v1`).
- Enforce strict input validation before requests reach application or domain services.
- Wrap all responses and errors in standard JSON envelopes.
- Support robust pagination, sorting, filtering, and idempotency guarantees.

# Rules
1. **Base Path & Versioning**: All public endpoints must reside under `/api/v1`. Breaking changes require a new version path or backward-compatible additive changes.
2. **Standard Response Envelopes**:
   - Single item: `{ "data": { ... }, "meta": { "requestId": "..." } }`
   - Collection: `{ "data": [ ... ], "meta": { "page": 1, "pageSize": 25, "total": 100, "requestId": "..." } }`
3. **Standard Error Envelopes**:
   - Error format: `{ "error": { "code": "ERROR_CODE", "message": "Human readable message", "requestId": "..." } }`
   - Internal exceptions, database constraints, and stack traces must never leak to clients in production.
4. **Idempotency Headers**:
   - Mutations must accept `Idempotency-Key: <UUID>`.
   - Matching key, actor, and payload returns the cached result; matching key with differing payload yields HTTP 409 Conflict.
5. **Pagination Standards**: Collections must use bounded pagination (`page`, `pageSize`, with a max ceiling such as 100). Cursor pagination is required for high-churn event feeds.
6. **Input Validation**: All incoming bodies, queries, and route parameters must be validated at the boundary via DTOs/pipes; unknown properties must be stripped.

# Required Checks
- [ ] Verify that new endpoints include correlation ID in headers and logging context.
- [ ] Ensure query filters and sort parameters are allow-listed to prevent SQL injection or table scans.
- [ ] Confirm HTTP status codes accurately reflect outcomes (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 422 Unprocessable Entity).
- [ ] Check that collection endpoints enforce pagination and do not return unbounded arrays.

# Common Mistakes
- Returning raw Prisma models or database rows containing sensitive fields (e.g. password hashes).
- Returning inconsistent response shapes (e.g. raw arrays or bare primitives).
- Trusting client-supplied IDs without verifying organization ownership.
- Exposing raw database syntax errors or 500 error traces to frontend clients.

# Definition Of Done
- API endpoints are fully typed, documented, and conform to the `/api/v1` envelope standard.
- Input validation rejects malformed payloads with descriptive 400/422 responses.
- Idempotency is supported and tested on state-changing endpoints.
- Integration tests confirm correct status codes and response structures.
