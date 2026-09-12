# ADR 0009 — Stock REST API Boundary & Separation of Concerns

## Status

Accepted

## Context

Phase 5A established the core stock schema (`StockBalance` and `StockLedgerEntry`), 4-decimal exact precision schema (`DECIMAL(14, 4)`), composite tenant-safe foreign keys, and PostgreSQL mathematical check constraints.
Phase 5B implemented the transactional stock mutation engine (`StockMutationService`) guaranteeing atomic balance updates, append-only immutable ledger creation, row-level locking (`SELECT ... FOR UPDATE`), idempotency replay, and non-negative stock policies.

Phase 5C delivers the production HTTP REST API layer (`StockController`, DTOs, and route mappings) exposing stock balances, chronological ledger history, and transactional mutations to API clients.

Stock mutations represent high-stakes operations that directly impact balance sheets, physical inventory counts, and fulfillment correctness. Controllers must not contain business logic, stock arithmetic, or database transactions.

## Decision

We establish an authoritative, thin REST API boundary with the following architectural rules:

### 1. Thin Controller & Service Boundary

- **Controllers Are Strictly Protocol Adapters**:
  - Authenticate the request (`JwtAuthGuard`).
  - Authorize the active organization (`OrganizationGuard` with `x-organization-id`).
  - Enforce RBAC permissions (`PermissionsGuard` with `@RequirePermissions`).
  - Validate and sanitize incoming HTTP payloads (`class-validator` / `ValidationPipe`).
  - Resolve authenticated caller context (`@CurrentUser()`, `@CurrentOrganization()`).
  - Delegate directly to domain services:
    - Mutations: `StockMutationService.mutateStock(...)`.
    - Queries: `StockFoundationService.findPaginatedBalances(...)`, `findPaginatedLedger(...)`, etc.
  - Map results to deterministic API response envelopes.
- **Forbidden in Controllers**:
  - No Prisma or direct database access.
  - No stock arithmetic or delta calculations.
  - No transaction management (`$transaction`).
  - No manual balance locking or row locking.
  - No negative-stock checks or business invariant assertions.

### 2. Route Registration & Ordering

To prevent NestJS parameterized route collision where dynamic `:id` intercepts static or sub-resource paths, routes are strictly registered in the following order:

1. `GET /api/v1/stock/balances` — List paginated balances
2. `GET /api/v1/stock/balances/product/:productId` — Balances by product
3. `GET /api/v1/stock/balances/warehouse/:warehouseId` — Balances by warehouse
4. `GET /api/v1/stock/balances/:id` — Balance detail by balance ID
5. `GET /api/v1/stock/ledger` — List paginated ledger entries
6. `GET /api/v1/stock/ledger/:id` — Ledger detail by ledger ID
7. `POST /api/v1/stock/mutations` — Execute transactional stock mutation

### 3. Exact Decimal HTTP Representation

JavaScript `Number` is an IEEE 754 floating-point format that cannot safely represent exact decimals.
All quantity inputs and outputs at the HTTP API boundary are strictly strings:

- Inputs (`quantityDelta`): Must be an exact decimal string with up to 4 decimal places (e.g. `"10.0000"`, `"-5.2500"`). JavaScript numbers in payloads are rejected with HTTP 400 Bad Request.
- Outputs (`quantity`, `quantityDelta`, `quantityBefore`, `quantityAfter`): Formatted deterministically as 4-decimal strings (via `toFixed(4)`).

### 4. Idempotency Contract & Response Codes

The API supports idempotency via both the `Idempotency-Key` HTTP header and request body `idempotencyKey`:

- If both header and body are provided, they must match exactly; a mismatch triggers HTTP 400 Bad Request.
- **First Successful Request**: Returns HTTP `201 Created` with `isIdempotentReplay: false`.
- **Identical Replay**: Returns HTTP `200 OK` with `isIdempotentReplay: true` and the original result, without creating duplicate ledger records.
- **Conflicting Parameters**: Same idempotency key with different mutation parameters returns HTTP `409 Conflict` (`STOCK_IDEMPOTENCY_CONFLICT`).
- **Tenant Scoping**: Idempotency keys are strictly scoped to the active organization (`organizationId`), permitting identical keys across different tenants.

### 5. Tenant Isolation & IDOR Protection

All queries and mutations enforce tenant isolation via `x-organization-id` header validated against active membership:

- Balance and ledger queries are filtered by `organizationId`.
- Entity lookups (product, warehouse, balance, ledger) verify organization ownership.
- Cross-tenant resource lookups return HTTP `404 Not Found` (never leaking resource existence or metadata across tenants).

### 6. RBAC Model

Minimal and authoritative:

- `stock.read`: Required for all read endpoints (`/balances*`, `/ledger*`).
- `stock.mutate`: Required for mutation endpoint (`POST /mutations`).

## Consequences

- **Pros**:
  - The domain mutation engine remains the single source of truth; no duplicate arithmetic or validation rules exist in controllers.
  - Zero risk of race conditions or lost updates introduced by REST layer.
  - Consistent exact-decimal contract avoids floating-point drift across client and server.
  - Comprehensive auditability and deterministic idempotency behavior.
- **Cons**:
  - API consumers must pass quantities as formatted strings rather than native JSON numbers.
