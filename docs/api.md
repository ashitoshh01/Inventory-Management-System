# API Contract

## General

Base path:

```text
/api/v1
```

Use JSON for normal APIs.

Response example:

```json
{
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

List:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 250
  }
}
```

Error:

```json
{
  "error": {
    "code": "INVENTORY_INSUFFICIENT_STOCK",
    "message": "Not enough available stock.",
    "requestId": "..."
  }
}
```

Do not expose stack traces, SQL errors, or internal exception messages in production.

## Endpoint groups

### Auth

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh` if token refresh is used
- `GET /auth/me`

### Users / roles

- `GET /users`
- `POST /users`
- `PATCH /users/:id`
- `GET /roles`
- `PUT /users/:id/roles`

### Catalog

- `GET /products`
- `POST /products`
- `GET /products/:id`
- `PATCH /products/:id`
- `POST /products/:id/archive`
- `GET /categories`
- `GET /brands`
- `GET /units`

### Warehouses

- `GET /warehouses`
- `POST /warehouses`
- `GET /warehouses/:id`
- `PATCH /warehouses/:id`

### Inventory

- `GET /inventory`
- `GET /inventory/summary`
- `GET /inventory/ledger`
- `POST /inventory/adjustments`
- `POST /inventory/counts`
- `POST /inventory/transfers`
- `POST /inventory/transfers/:id/approve`
- `POST /inventory/transfers/:id/ship`
- `POST /inventory/transfers/:id/receive`

### Purchasing

- `GET /purchase-orders`
- `POST /purchase-orders`
- `PATCH /purchase-orders/:id`
- `POST /purchase-orders/:id/approve`
- `POST /purchase-orders/:id/receive`

### Sales

- `GET /sales`
- `POST /sales`
- `GET /sales/:id`
- `POST /sales/:id/confirm`
- `POST /sales/:id/cancel`

### Returns

- `POST /returns`
- `GET /returns`
- `GET /returns/:id`

### Reports

- `GET /reports/sales`
- `GET /reports/inventory-value`
- `GET /reports/stock-movement`
- `POST /reports/exports`

## Pagination contract

Support:

- `page`
- `pageSize`
- `sortBy`
- `sortOrder`
- filters

Clamp `pageSize` server-side, for example to 100.

## Filtering

Whitelist filterable/sortable fields. Never interpolate arbitrary client input into SQL identifiers.

## Idempotency

Mutation requests may include:

```http
Idempotency-Key: <uuid>
```

For supported operations:

- same key + same actor + same endpoint should return the original result;
- same key with materially different payload should fail;
- records expire according to a documented retention policy.

## API versioning

Breaking changes require a new version or compatibility strategy.

Prefer additive changes:

- add optional fields;
- add endpoints;
- deprecate before removal.

## Authorization

Every controller route must declare its required permission or use a policy guard.

Example concept:

```text
inventory.adjust
```

The API checks:

1. authenticated user;
2. active organization;
3. role/permission;
4. resource scope;
5. business-state rules.

## Transactions

The controller must not own stock transaction logic. The application service/use case does.

## Webhooks

For inbound webhooks:

- verify signature;
- persist receipt;
- deduplicate;
- process asynchronously when possible;
- return quickly;
- retry safely.

## Phase 2A Updates

- Standardized envelope format `{ data, meta: { requestId } }` via TransformInterceptor.
- Added endpoints: `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`, `/organizations`, `/organizations/:id`, `/organizations/:id/members`, `/organizations/:id/members/:memberId`.
- All organization scoped endpoints require `x-organization-id` header.

## Phase 2B Updates — Core Domain Foundation

- **Pagination Contract**:
  - Query parameters:
    - `page`: 1-based integer index (default: `1`).
    - `limit`: items per page, clamped to a maximum of `100` (default: `20`).
    - `sortBy`: string field name validated against an explicit domain allowlist.
    - `sortOrder`: `ASC` or `DESC` (case-insensitive, defaults to `ASC`).
  - Standardized Paginated Response Envelope:
    ```json
    {
      "data": [ ... ],
      "meta": {
        "page": 1,
        "limit": 20,
        "total": 250,
        "totalPages": 13,
        "hasNextPage": true,
        "hasPreviousPage": false,
        "requestId": "req-12345"
      }
    }
    ```
- **Sorting Security & Allowlists**:
  - `validateSortField(dto, allowedFields)` validates that requested sort keys belong to an explicit allowlist. Disallowed fields trigger `BadRequestException` to prevent SQL/field injection.
- **Domain Exception & Database Error Codes**:
  - `DUPLICATE_RESOURCE` (HTTP 409): Unique constraint violation (Prisma P2002). Internal database index details are sanitized.
  - `NOT_FOUND` (HTTP 404): Resource not found or tenant boundary cross attempt (Prisma P2025 / `EntityNotFoundException`).
  - `FOREIGN_KEY_VIOLATION` (HTTP 400): Referenced entity does not exist or relation constraint failed (Prisma P2003). Internal constraint details are sanitized.
  - `TENANT_VIOLATION` (HTTP 403 / 404): Cross-tenant access attempt.
  - `INVALID_STATE_TRANSITION` (HTTP 400): Attempted lifecycle transition not permitted by domain state machine.
  - `INVALID_MONEY_AMOUNT` (HTTP 400): Malformed currency or negative/fractional minor unit violation.
  - `INVALID_QUANTITY` (HTTP 400): Precision overflow (beyond 4 decimal places) or negative quantity violation.

## Phase 3A Updates — Category Foundation

- **Category Endpoints**:
  - `POST /api/v1/categories` — Create category (`category.create` permission).
    - Body: `{ name: string, description?: string }`.
    - Auto-scoped to active tenant via `x-organization-id`. Reject attempts to provide `organizationId` in payload.
    - Status: `201 Created` or `409 Conflict` (`CATEGORY_DUPLICATE`).
  - `GET /api/v1/categories` — List categories (`category.read` permission).
    - Query parameters: `page` (default 1), `limit` (default 20, max 100), `sortBy` (`name` | `createdAt` | `updatedAt`), `sortOrder` (`asc` | `desc`), `search` (case-insensitive substring filter on name).
    - Strictly scoped to active organization.
    - Status: `200 OK`.
  - `GET /api/v1/categories/:id` — Retrieve single category (`category.read` permission).
    - Parameter `:id` validated as UUIDv4.
    - Returns `404 Not Found` (`CATEGORY_NOT_FOUND`) if nonexistent or owned by another tenant (IDOR prevention).
    - Status: `200 OK`.
  - `PATCH /api/v1/categories/:id` — Update category (`category.update` permission).
    - Body: `{ name?: string, description?: string }`.
    - Reject protected field mutations (`id`, `organizationId`, `createdAt`).
    - Status: `200 OK` or `409 Conflict` (`CATEGORY_DUPLICATE`) if renamed to an existing name in the same tenant.
  - `DELETE /api/v1/categories/:id` — Delete category (`category.delete` permission).
    - Hard deletion with referential integrity.
    - Status: `200 OK` or `409 Conflict` (`CATEGORY_DELETE_CONFLICT`) if referenced by other resources.

## Phase 3C Updates — Product API Implementation

- **Base Route**: `/api/v1/products`
- **Security & Headers**:
  - Requires valid Bearer JWT cookie/header (`JwtAuthGuard`).
  - Requires `x-organization-id` header validating active tenant membership (`OrganizationGuard`).
  - Permissions enforced via `@RequirePermissions(...)` with `PermissionsGuard`.
- **Endpoints**:
  - `POST /api/v1/products` — Create Product (`product.create` permission)
    - Body: `{ sku: string, name: string, description?: string, categoryId: string (UUIDv4), unitOfMeasure?: UnitOfMeasure, status?: ProductStatus }`
    - Validation: SKU normalized (trimmed, uppercase), length rules, UOM/Status enums, rejects unknown and protected fields (`id`, `organizationId`, etc.).
    - Category validation: categoryId must exist in active tenant; cross-tenant references fail with `400 Bad Request` (`INVALID_CATEGORY_REFERENCE`).
    - Uniqueness: duplicate SKU in same tenant fails with `409 Conflict` (`PRODUCT_DUPLICATE_SKU`). Identical SKU allowed across different tenants.
    - Status: `201 Created` with standard API envelope and audit event `product.created`.
  - `GET /api/v1/products` — List Products (`product.read` permission)
    - Query parameters:
      - `page`: integer (default: 1)
      - `limit`: integer (default: 20, max: 100)
      - `search`: string (case-insensitive search across `name`, `sku`, `description`)
      - `categoryId`: string (UUIDv4 filter)
      - `status`: string (`ACTIVE` | `INACTIVE`)
      - `unitOfMeasure`: string (`UNIT` | `KG` | `G` | `L` | `ML` | `M` | `CM` | `BOX` | `PACK`)
      - `sortBy`: string (`name` | `sku` | `createdAt` | `updatedAt` | `status` | `unitOfMeasure`, default: `createdAt`)
      - `sortOrder`: `asc` | `desc` (default: `desc`)
    - Strictly scoped to active tenant. Safe parameterized queries (SQL injection immune).
    - Status: `200 OK` with paginated metadata envelope (`page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPreviousPage`, `requestId`).
  - `GET /api/v1/products/sku/:sku` — Retrieve Product by SKU (`product.read` permission)
    - Parameter `:sku`: normalized case-insensitively.
    - Returns `404 Not Found` (`PRODUCT_NOT_FOUND`) if SKU does not exist in the active organization.
    - Status: `200 OK`.
  - `GET /api/v1/products/:id` — Retrieve Product by ID (`product.read` permission)
    - Parameter `:id`: validated as UUIDv4.
    - Tenant isolation: returns `404 Not Found` (`PRODUCT_NOT_FOUND`) on IDOR or nonexistent record.
    - Status: `200 OK` including joined `category` details.
  - `PATCH /api/v1/products/:id` — Update Product (`product.update` permission)
    - Body: `{ name?: string, sku?: string, description?: string, categoryId?: string, unitOfMeasure?: UnitOfMeasure, status?: ProductStatus }`
    - Rejects protected field mutations (`id`, `organizationId`, `createdAt`, `updatedAt`).
    - Category reassignment validated against active tenant (`400 Bad Request` on cross-tenant category).
    - SKU updates check for duplicate collisions in active tenant (`409 Conflict`).
    - Emits immutable `product.updated` audit event with `changedFields`.
    - Status: `200 OK`.
  - `DELETE /api/v1/products/:id` — Delete Product (`product.delete` permission)
    - Parameter `:id`: validated as UUIDv4.
    - Tenant isolation: returns `404 Not Found` on IDOR attempt.
    - Returns `409 Conflict` (`PRODUCT_DELETE_CONFLICT`) if referenced by other foreign key relationships.
    - Emits immutable `product.deleted` audit event.
    - Status: `200 OK` with `{ message: 'Product deleted successfully', id }`.
