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

## Phase 4B Updates — Warehouse REST API

- **Base Route**: `/api/v1/warehouses`
- **Security & Headers**:
  - Requires valid Bearer JWT cookie/header (`JwtAuthGuard`).
  - Requires `x-organization-id` header validating active tenant membership (`OrganizationGuard`).
  - Permissions enforced via `@RequirePermissions(...)` with `PermissionsGuard`.
- **Endpoints**:
  - `POST /api/v1/warehouses` — Create Warehouse (`warehouse.create` permission)
    - Body: `{ name: string, code: string, description?: string, addressLine1?: string, addressLine2?: string, city?: string, state?: string, postalCode?: string, country?: string, status?: WarehouseStatus, isDefault?: boolean }`
    - Validation: Name (2–100 chars), Code normalized (trimmed, uppercase, 2–50 chars, `^[A-Z0-9_-]+$`), Status (`ACTIVE` | `INACTIVE`), reject unknown and protected fields (`id`, `organizationId`, `createdAt`, `updatedAt`).
    - Default warehouse: The first warehouse in an organization automatically becomes default; setting `isDefault: true` atomically unsets any prior default.
    - Uniqueness: Duplicate code or duplicate name within the active organization returns `409 Conflict` (`WAREHOUSE_DUPLICATE_CODE` / `WAREHOUSE_DUPLICATE_NAME`). Identical codes permitted across separate organizations.
    - Status: `201 Created` with standard API envelope and audit event `warehouse.created`.
  - `GET /api/v1/warehouses` — List Warehouses (`warehouse.read` permission)
    - Query parameters:
      - `page`: integer (default: 1)
      - `limit`: integer (default: 20, max: 100)
      - `search`: string (case-insensitive search across `name`, `code`, `city`)
      - `status`: string (`ACTIVE` | `INACTIVE`)
      - `sortBy`: string (`name` | `code` | `city` | `status` | `createdAt` | `updatedAt`, default: `createdAt`)
      - `sortOrder`: `asc` | `desc` (default: `desc`)
    - Strictly scoped to active tenant. Disallowed sort fields return `400 Bad Request`.
    - Status: `200 OK` with paginated metadata envelope (`page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPreviousPage`, `requestId`).
  - `GET /api/v1/warehouses/code/:code` — Retrieve Warehouse by Code (`warehouse.read` permission)
    - Parameter `:code`: normalized uppercase.
    - Tenant isolation: Returns `404 Not Found` (`WAREHOUSE_NOT_FOUND`) if code does not exist in the active organization.
    - Status: `200 OK`.
  - `GET /api/v1/warehouses/:id` — Retrieve Warehouse by ID (`warehouse.read` permission)
    - Parameter `:id`: validated as UUIDv4.
    - Tenant isolation: Returns `404 Not Found` (`WAREHOUSE_NOT_FOUND`) on IDOR or nonexistent record.
    - Status: `200 OK`.
  - `PATCH /api/v1/warehouses/:id` — Update Warehouse (`warehouse.update` permission)
    - Body: `{ name?: string, code?: string, description?: string, addressLine1?: string, addressLine2?: string, city?: string, state?: string, postalCode?: string, country?: string, status?: WarehouseStatus, isDefault?: boolean }`
    - Rejects protected field mutations (`id`, `organizationId`, `createdAt`, `updatedAt`).
    - Uniqueness: Checks against collisions in active tenant (`409 Conflict`).
    - Default switching: Setting `isDefault: true` atomically switches default from previous warehouse.
    - Status: `200 OK` with audit event `warehouse.updated`.
  - `DELETE /api/v1/warehouses/:id` — Delete Warehouse (`warehouse.delete` permission)
    - Parameter `:id`: validated as UUIDv4.
    - Tenant isolation: Returns `404 Not Found` on cross-tenant IDOR attempt.
    - Default conflict: Deleting the designated default warehouse returns `409 Conflict` (`WAREHOUSE_DELETE_CONFLICT`).
    - Status: `204 No Content` (empty body) with audit event `warehouse.deleted`.

## Phase 5C Updates — Stock REST API

- **Base Route**: `/api/v1/stock`
- **Security & Guards**:
  - `JwtAuthGuard`: Enforces active authenticated session via HttpOnly cookie or Bearer token (`401 Unauthorized`).
  - `OrganizationGuard`: Enforces membership in tenant specified via `x-organization-id` (`403 Forbidden`).
  - `PermissionsGuard`: Enforces RBAC permissions:
    - `stock.read`: Required for all balance and ledger read endpoints.
    - `stock.mutate`: Required for mutation endpoint.
- **Exact Decimal Contract**:
  - Quantities must be passed and returned as exact decimal strings with at most 4 decimal places (e.g. `"10.0000"`, `"-5.2500"`). JavaScript numbers in payloads are rejected with `400 Bad Request`.
- **Endpoints**:
  - `GET /api/v1/stock/balances` — List Stock Balances (`stock.read` permission)
    - Query parameters:
      - `page`: integer (default: 1)
      - `limit`: integer (default: 20, max: 100)
      - `productId`: UUIDv4 filter (optional)
      - `warehouseId`: UUIDv4 filter (optional)
      - `sortBy`: string (`quantity` | `createdAt` | `updatedAt` | `productId` | `warehouseId`, default: `createdAt`)
      - `sortOrder`: `asc` | `desc` (default: `desc`)
    - Disallowed sort fields return `400 Bad Request`.
    - Status: `200 OK` with paginated metadata envelope.
  - `GET /api/v1/stock/balances/product/:productId` — Balances by Product (`stock.read` permission)
    - Parameter `:productId`: validated as UUIDv4.
    - Verifies product exists in active organization; returns `404 Not Found` (`PRODUCT_NOT_FOUND`) if nonexistent or cross-tenant.
    - Status: `200 OK`.
  - `GET /api/v1/stock/balances/warehouse/:warehouseId` — Balances by Warehouse (`stock.read` permission)
    - Parameter `:warehouseId`: validated as UUIDv4.
    - Verifies warehouse exists in active organization; returns `404 Not Found` (`WAREHOUSE_NOT_FOUND`) if nonexistent or cross-tenant.
    - Status: `200 OK`.
  - `GET /api/v1/stock/balances/:id` — Balance Detail (`stock.read` permission)
    - Parameter `:id`: validated as UUIDv4.
    - Tenant isolation: Returns `404 Not Found` (`STOCK_BALANCE_NOT_FOUND`) on cross-tenant IDOR attempt.
    - Status: `200 OK`.
  - `GET /api/v1/stock/ledger` — List Chronological Stock Ledger (`stock.read` permission)
    - Query parameters:
      - `page`: integer (default: 1)
      - `limit`: integer (default: 20, max: 100)
      - `productId`: UUIDv4 filter (optional)
      - `warehouseId`: UUIDv4 filter (optional)
      - `type`: `OPENING` | `RECEIPT` | `ISSUE` | `ADJUSTMENT` (optional)
      - `sortBy`: string (`createdAt` | `quantityDelta` | `quantityBefore` | `quantityAfter` | `type`, default: `createdAt`)
      - `sortOrder`: `asc` | `desc` (default: `desc`)
    - Immutable audit ledger; no update or delete operations are permitted.
    - Status: `200 OK` with paginated metadata envelope.
  - `GET /api/v1/stock/ledger/:id` — Ledger Detail (`stock.read` permission)
    - Parameter `:id`: validated as UUIDv4.
    - Returns immutable record; cross-tenant requests return `404 Not Found`.
    - Status: `200 OK`.
  - `POST /api/v1/stock/mutations` — Execute Stock Mutation (`stock.mutate` permission)
    - Headers:
      - `Idempotency-Key`: optional string (alphanumeric, underscores, hyphens, max 100 chars)
      - `x-organization-id`: required active tenant ID
    - Body:
      ```json
      {
        "productId": "uuid",
        "warehouseId": "uuid",
        "type": "OPENING | RECEIPT | ISSUE | ADJUSTMENT",
        "quantityDelta": "string (exact decimal, max 4 decimal places, non-zero)",
        "idempotencyKey": "string (optional, must match header if both provided)",
        "referenceType": "string (optional, max 50 chars)",
        "referenceId": "string (optional, max 100 chars)",
        "metadata": {}
      }
      ```
    - Idempotency reconciliation: If both header and body keys are provided, they must match (`400 Bad Request` on mismatch).
    - Status:
      - `201 Created` for first successful mutation (`isIdempotentReplay: false`).
      - `200 OK` for identical replay (`isIdempotentReplay: true`), without creating duplicate ledger records.
      - `409 Conflict` (`STOCK_IDEMPOTENCY_CONFLICT`) if key was used with different payload.
      - `409 Conflict` (`STOCK_INSUFFICIENT_QUANTITY`) if mutation would result in negative stock.
      - `409 Conflict` (`STOCK_OPENING_INVALID_STATE`) if OPENING is applied to non-zero balance or prior history.

## Phase 6B Updates — Purchase Orders REST API

- **Base Route**: `/api/v1/purchase-orders`
- **Security & Guards**:
  - `JwtAuthGuard`: Enforces active authenticated session (`401 Unauthorized`).
  - `OrganizationGuard`: Enforces active tenant membership via `x-organization-id` (`403 Forbidden`).
  - `PermissionsGuard`: Enforces fine-grained procurement permissions:
    - `purchase-order.read`: View purchase order details and lists.
    - `purchase-order.create`: Create new purchase orders.
    - `purchase-order.update`: Update draft purchase orders.
    - `purchase-order.delete`: Delete draft purchase orders.
    - `purchase-order.submit`: Submit draft purchase orders for approval.
    - `purchase-order.approve`: Approve submitted purchase orders.
    - `purchase-order.cancel`: Cancel active purchase orders.
- **Precision & Monetary Arithmetic Rules**:
  - `quantity`: Exact positive decimal string with up to 4 decimal places (strictly > 0).
  - `unitPrice`: Exact non-negative decimal string with up to 4 decimal places (>= 0).
  - Server Authoritative Totals: `lineTotal`, `subtotal`, and `grandTotal` are computed server-side via exact `Prisma.Decimal` arithmetic (`quantity * unitPrice`). Client-supplied totals are rejected with `400 Bad Request`.
- **CRITICAL Stock Boundary Invariant**:
  - Purchase order endpoints strictly NEVER modify `StockBalance` or write to `StockLedgerEntry`. Procurement and inventory balances are decoupled in this phase.
- **Endpoints**:
  - `POST /api/v1/purchase-orders` — Create Purchase Order (`purchase-order.create`)
    - Headers:
      - `Idempotency-Key`: optional string (alphanumeric, underscores, hyphens, max 100 chars)
      - `x-organization-id`: required active tenant ID
    - Body:
      ```json
      {
        "purchaseOrderNumber": "PO-2026-001",
        "supplierName": "Acme Industrial",
        "supplierEmail": "vendor@acme.com",
        "warehouseId": "uuid",
        "orderDate": "2026-09-12T00:00:00.000Z",
        "expectedDate": "2026-09-20T00:00:00.000Z",
        "currency": "INR",
        "notes": "Optional notes",
        "idempotencyKey": "optional key matching header",
        "lines": [
          {
            "productId": "uuid",
            "quantity": "10.0000",
            "unitPrice": "25.5000",
            "notes": "Line item note"
          }
        ]
      }
      ```
    - Status:
      - `201 Created` on new purchase order.
      - `200 OK` on idempotent replay.
      - `400 Bad Request` on invalid input or idempotency header/body key mismatch.
      - `404 Not Found` if warehouse or product does not belong to active organization.
      - `409 Conflict` on duplicate PO number in tenant or idempotency payload mismatch.
  - `GET /api/v1/purchase-orders` — List Purchase Orders (`purchase-order.read`)
    - Query parameters:
      - `page`: integer (default: 1)
      - `limit`: integer (default: 20, max: 100)
      - `status`: `DRAFT` | `SUBMITTED` | `APPROVED` | `PARTIALLY_RECEIVED` | `RECEIVED` | `CLOSED` | `CANCELLED`
      - `warehouseId`: UUIDv4
      - `supplierName`: string substring filter
      - `purchaseOrderNumber`: string substring filter
      - `search`: string search across PO number, supplier name, and notes
      - `sortBy`: `createdAt` | `updatedAt` | `orderDate` | `expectedDate` | `purchaseOrderNumber` | `status` | `grandTotal` (default: `createdAt`)
      - `sortOrder`: `asc` | `desc` (default: `desc`)
    - Status: `200 OK` with paginated metadata envelope.
  - `GET /api/v1/purchase-orders/:id` — Get Purchase Order Detail (`purchase-order.read`)
    - Parameter `:id`: UUIDv4
    - Returns purchase order with nested lines sorted by `createdAt: asc`.
    - Status: `200 OK` or `404 Not Found` (anti-enumeration).
  - `PATCH /api/v1/purchase-orders/:id` — Update Draft Purchase Order (`purchase-order.update`)
    - Parameter `:id`: UUIDv4
    - Body: partial fields (`supplierName`, `supplierEmail`, `warehouseId`, `orderDate`, `expectedDate`, `currency`, `notes`, `lines`).
    - Allowed only when status is `DRAFT`. Attempting to update non-DRAFT PO returns `409 Conflict`.
    - Status: `200 OK`.
  - `DELETE /api/v1/purchase-orders/:id` — Delete Draft Purchase Order (`purchase-order.delete`)
    - Parameter `:id`: UUIDv4
    - Allowed only when status is `DRAFT`. Attempting to delete non-DRAFT PO returns `409 Conflict`.
    - Status: `200 OK`.
  - `POST /api/v1/purchase-orders/:id/submit` — Submit Purchase Order (`purchase-order.submit`)
    - Transitions PO from `DRAFT` to `SUBMITTED`.
    - Status: `201 Created` or `400 Bad Request` if invalid transition.
  - `POST /api/v1/purchase-orders/:id/approve` — Approve Purchase Order (`purchase-order.approve`)
    - Transitions PO from `SUBMITTED` to `APPROVED`. Sets `approvedById` and `approvedAt`.
    - Status: `201 Created` or `400 Bad Request` if invalid transition.
  - `POST /api/v1/purchase-orders/:id/cancel` — Cancel Purchase Order (`purchase-order.cancel`)
    - Transitions PO to `CANCELLED` from any valid pre-terminal state.
    - Status: `201 Created` or `400 Bad Request` if terminal.

## Phase 6D Updates — Purchase Order Receiving & Inventory Integration

- **Authorization & RBAC**:
  - `POST /api/v1/purchase-orders/:id/receive` requires `purchase-order.receive` permission.
  - `GET /api/v1/purchase-orders/:id/receipts` requires `purchase-order.read` permission.
- **Endpoints**:
  - `POST /api/v1/purchase-orders/:id/receive` — Receive Inventory Against Approved Purchase Order (`purchase-order.receive`)
    - Parameter `:id`: UUIDv4
    - Headers:
      - `Idempotency-Key` (optional, string): Database-enforced idempotency key.
    - Body (`ReceivePurchaseOrderDto`):
      - `lines`: array of objects (`ReceivePurchaseOrderItemDto`):
        - `purchaseOrderLineId`: UUIDv4 (must belong to this purchase order)
        - `quantity`: exact decimal string matching `/^\d+(\.\d{1,4})?$/`, strictly > 0
      - `notes`: optional string, maximum 500 characters
    - Business Rules:
      - PO must be in `APPROVED` or `PARTIALLY_RECEIVED` status. Otherwise returns `400 Bad Request` (`PURCHASE_ORDER_NOT_APPROVED_FOR_RECEIPT`).
      - Over-receiving is strictly prohibited: `currentReceived + quantity <= quantityOrdered` on every line. Otherwise returns `400 Bad Request` (`PURCHASE_ORDER_OVER_RECEIPT_NOT_ALLOWED`).
      - Atomically updates:
        1. Row lock `FOR UPDATE` on `PurchaseOrder` and child `PurchaseOrderLine` rows.
        2. Increments `PurchaseOrderLine.receivedQuantity`.
        3. Generates sequential receipt number `GR-<PO_NUMBER>-<SEQUENCE>` and persists `GoodsReceipt` + `GoodsReceiptLine`.
        4. Mutates inventory via authoritative `StockMutationService.mutateStockTx` with `type: 'RECEIPT'`, referenceType `'PURCHASE_ORDER'`, updating `StockBalance` and appending `StockLedgerEntry`.
        5. Updates PO status: `PARTIALLY_RECEIVED` if some lines partially received, `RECEIVED` if all lines fully received (`receivedQuantity >= quantity`).
        6. Logs transactional `AuditEvent` with action `'purchase-order.received'`.
    - Status:
      - `201 Created` with `{ order: PurchaseOrderDto, receipt: GoodsReceiptDto, isIdempotentReplay: boolean }`.
      - `400 Bad Request` if order not eligible, over-receipt attempted, or line invalid.
      - `404 Not Found` if order does not exist in organization.
      - `409 Conflict` (`PURCHASE_ORDER_RECEIPT_IDEMPOTENCY_MISMATCH`) if idempotency key reused with mismatched payload.
  - `GET /api/v1/purchase-orders/:id/receipts` — Get Goods Receipt History (`purchase-order.read`)
    - Parameter `:id`: UUIDv4
    - Returns array of `GoodsReceiptDto` ordered by `receivedAt: desc` with child `GoodsReceiptLineDto` rows.
    - Status: `200 OK` or `404 Not Found`.

## Phase 6E Updates — Procurement Operations, Reconciliation & Production QA

- **Authorization & RBAC**:
  - `GET /api/v1/purchase-orders/metrics` requires `purchase-order.read` permission.
  - `GET /api/v1/purchase-orders/:id/reconciliation` requires `purchase-order.read` permission.
  - `GET /api/v1/purchase-orders/:id/audit-trail` requires `purchase-order.read` permission.
- **Operational Query Parameters (`GET /api/v1/purchase-orders`)**:
  - `isOverdue` (boolean, optional): Filters orders that are past their expected delivery date and still outstanding (`status IN ['APPROVED', 'PARTIALLY_RECEIVED']`). When `false`, excludes overdue orders.
  - `receivingState` (string enum, optional): `'OUTSTANDING'` (filters for `APPROVED` or `PARTIALLY_RECEIVED`) or `'RECEIVED'` (filters for `RECEIVED`).
  - `startDate` (ISO 8601 string, optional): Lower bound filter on `orderDate`.
  - `endDate` (ISO 8601 string, optional): Upper bound filter on `orderDate`.
  - `supplierName` (string, optional): Case-insensitive partial text match on supplier name.
- **Endpoints**:
  - `GET /api/v1/purchase-orders/metrics` — Aggregate Procurement KPI Metrics (`purchase-order.read`)
    - Returns tenant-scoped counts and quantities:
      - `totalOrders`: Total purchase orders count in organization.
      - `statusCounts`: Object with count of orders per status (`DRAFT`, `SUBMITTED`, `APPROVED`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELLED`).
      - `totalOrderedQuantity`: Sum of ordered quantities across all PO lines formatted as exact 4-decimal string.
      - `totalReceivedQuantity`: Sum of received quantities across all PO lines formatted as exact 4-decimal string.
      - `totalOutstandingQuantity`: Exact difference `totalOrdered - totalReceived`.
      - `pendingReceivingCount`: Count of orders in `APPROVED` or `PARTIALLY_RECEIVED` status.
      - `overdueCount`: Count of pending orders where `expectedDate < now`.
      - `recentlyReceivedCount`: Count of orders with receipts in the last 7 days.
    - Strictly read-only; no database or inventory mutations.
    - Status: `200 OK`.
  - `GET /api/v1/purchase-orders/:id/reconciliation` — Live Inventory Reconciliation Cross-Check (`purchase-order.read`)
    - Parameter `:id`: UUIDv4
    - Mathematical multi-way cross-verification:
      - PO Lines `receivedQuantity`
      - Child `GoodsReceiptLine` sum
      - Ledger `StockLedgerEntry` sum with `referenceType: 'PURCHASE_ORDER'` and `type: 'RECEIPT'`
      - Physical `StockBalance` verification
    - Returns `PurchaseOrderReconciliationDto`:
      - `purchaseOrderId`: UUIDv4
      - `purchaseOrderNumber`: string
      - `status`: `PurchaseOrderStatus`
      - `isReconciled`: boolean (`true` if and only if zero discrepancies detected across all lines)
      - `totalOrderedQuantity`: exact decimal string
      - `totalReceivedQuantity`: exact decimal string
      - `totalRemainingQuantity`: exact decimal string
      - `totalGoodsReceiptQuantity`: exact decimal string
      - `totalReceiptLedgerDelta`: exact decimal string
      - `lines`: array of `PurchaseOrderReconciliationLineDto`
      - `discrepancies`: array of human-readable discrepancy descriptions (empty when reconciled)
    - Strictly read-only; performs zero mutations.
    - Status: `200 OK` or `404 Not Found`.
  - `GET /api/v1/purchase-orders/:id/audit-trail` — Chronological Purchase Order Audit History (`purchase-order.read`)
    - Parameter `:id`: UUIDv4
    - Returns array of `PurchaseOrderAuditEventDto` chronologically sorted (newest first).
    - Status: `200 OK` or `404 Not Found`.
