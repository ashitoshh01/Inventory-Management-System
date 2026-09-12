# API Application (`@repo/api`)

Production-grade NestJS backend foundation for the Modular Monolith Inventory Management System.

---

## 1. Overview & Architecture

The API application serves as the core backend service built with **NestJS 11**, designed following clean architecture, defensive coding standards, and strict boundary controls.

- **Modular Monolith**: Business logic will be isolated inside domain modules under `src/modules/`.
- **Global Prefix**: Versioned at `/api/v1` (with exclusions for root health probes).
- **Enveloped Contracts**: Every response and error strictly conforms to standard envelopes.

---

## 2. Security & Request Hardening

### Correlation ID / Request ID (`x-request-id`)

- **Validation**: Client-supplied `x-request-id` headers are validated against `/^[a-zA-Z0-9_.-]{1,128}$/`.
- **Sanitization**: Values exceeding 128 characters or containing invalid/injection characters are discarded.
- **Generation**: Missing or invalid IDs automatically fall back to an RFC 4122 UUIDv4.
- **Propagation**: Reflected back on `x-request-id` response headers and included in every response (`meta.requestId`) and error envelope (`error.requestId`).

### CORS Configuration

- Configured via the `CORS_ORIGIN` environment variable (comma-separated list of allowed origins).
- In development, defaults to `['http://localhost:3000', 'http://127.0.0.1:3000']`.
- In production, explicit origins are required; wildcard (`*`) with credentials is explicitly forbidden.
- Unauthorized origins receive no `Access-Control-Allow-Origin` header.

### Security Headers

- Protected with **Helmet** middleware providing default HTTP security headers (`X-Content-Type-Options: nosniff`, HSTS, CSP, etc.).

---

## 3. Global Validation & Error Envelopes

### Strict DTO Validation

Configured globally via `ValidationPipe`:

- `whitelist: true`: Strips unknown properties.
- `forbidNonWhitelisted: true`: Immediately rejects payloads with unapproved properties with HTTP 400.
- `transform: true`: Automatically transforms incoming plain payloads into validated DTO instances.

### Standardized Envelopes

All HTTP responses adhere to strict contract structures:

#### Success Response

```json
{
  "data": { ... },
  "meta": {
    "requestId": "c3224e74-3c3b-4571-a9b3-974da0904315"
  }
}
```

#### Error Response

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "property injectedProp should not exist",
    "requestId": "55f6b363-ba1b-4ecc-8659-bb9d8ef4c4d5",
    "details": ["property injectedProp should not exist"]
  }
}
```

_Note: Stack traces, internal paths, and SQL statements are never leaked in error responses._

---

## 4. Observability & Structured Logging

- **Format**: Single-line structured JSON logs with standardized fields:
  - `timestamp`: ISO 8601 UTC.
  - `level`: `info`, `warn`, `error`, `debug`.
  - `service`: `api`.
  - `environment`: `NODE_ENV`.
  - `message`: Clear summary.
  - `context`: Class or domain context.
  - `requestId`: Distributed tracing correlation ID.
  - `route`, `statusCode`, `durationMs`: HTTP access metadata.

---

## 5. Health Probes

Mounted dual-path on both root (`/health`) and versioned (`/api/v1/health`) paths:

| Route               | Method | Purpose                          | Dependencies Checked                    |
| ------------------- | ------ | -------------------------------- | --------------------------------------- |
| `/health/liveness`  | `GET`  | Container/process liveness probe | In-memory process uptime                |
| `/health/readiness` | `GET`  | Readiness & dependency probe     | PostgreSQL (`SELECT 1`), Redis (`PING`) |

---

## 6. Graceful Shutdown

- NestJS shutdown hooks enabled (`app.enableShutdownHooks()`).
- All background connection probes (pg client, ioredis client) guarantee immediate socket teardown in `finally` blocks.
- Listens to `SIGTERM` and `SIGINT` signals for orderly HTTP server and connection pool termination.

---

## 7. Testing & Quality Gates

Run the automated foundation test suite:

```bash
pnpm --filter @repo/api test
```

Quality verification:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```
