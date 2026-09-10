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
