# Architecture

## Decision

Use a **decoupled modular monolith** with separate web (`apps/web`) and API (`apps/api`) applications inside a pnpm/Turborepo monorepo.

- **Frontend**: Next.js 16.x Active LTS + React 19.x
- **Backend**: NestJS
- **Shared Packages**:
  - `packages/database`: PostgreSQL 16+ access layer via Prisma (consumed exclusively by `apps/api` and migration tooling; never imported by `apps/web`)
  - `packages/ui`: Shared accessible UI primitives
  - `packages/types`: Shared domain primitives and DTO contracts
  - `packages/config`: Shared TypeScript, ESLint, and Prettier configurations

```text
Browser
   │
   ▼
Next.js 16 Web (apps/web)
   │ HTTPS / JSON
   ▼
NestJS API (apps/api)
   ├── Auth & Users
   ├── Catalog
   ├── Warehouses
   ├── Inventory
   ├── Purchasing
   ├── Sales / POS
   ├── Returns
   ├── Suppliers
   ├── Customers
   ├── Reports
   ├── Notifications
   ├── Audit
   └── Integrations
        │
        ├── PostgreSQL  ← source of truth
        ├── Redis       ← cache/queues/rate limits
        └── S3          ← files
```

## Why not microservices?

At ~100 concurrent users, a modular monolith gives:

- one transaction boundary for stock operations;
- simpler deployment;
- simpler local development;
- fewer network failure modes;
- lower infrastructure cost;
- easier debugging.

Domain modules still have strict boundaries so extraction remains possible later.

## API module pattern

```text
modules/inventory/
├── inventory.module.ts
├── controllers/
├── application/
│   ├── commands/
│   └── queries/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   └── services/
├── infrastructure/
│   ├── repositories/
│   └── mappers/
└── dto/
```

Do not force every module to use every folder. Use the structure when complexity warrants it.

## Request flow

```text
HTTP request
 → authentication
 → tenant/org context
 → authorization
 → input validation
 → controller
 → application use case
 → domain rules
 → repository
 → PostgreSQL transaction
 → audit event
 → response
```

## Sync vs async

Keep synchronous:

- CRUD for normal records;
- stock mutations;
- small searches;
- permission checks.

Move to background jobs:

- large CSV/XLSX import;
- large exports;
- report generation;
- email;
- notification fan-out;
- image processing;
- scheduled expiry scans;
- low-stock notification fan-out.

A job must be retry-safe.

## Scalability

For 100 concurrent users, start with:

- 2 API instances if deployment supports it;
- 1–2 web instances depending on hosting;
- managed PostgreSQL;
- managed Redis;
- object storage;
- load balancer/reverse proxy.

Scale based on metrics rather than guesses.

## Failure principles

- PostgreSQL failure: application should fail closed for mutations.
- Redis failure: core CRUD and stock correctness should continue where practical; queue-backed features may degrade.
- Object storage failure: database record should not claim a file was successfully stored.
- Email provider failure: business mutation should not roll back merely because email failed; queue/retry instead.
- External integration failure: isolate with timeouts, retries, circuit-breaking where justified.

## Multi-tenancy

If the product will serve multiple companies, model `Organization`/`Tenant` from the beginning.

Every tenant-owned table should have an `organizationId` or an unambiguous ownership path.

Authorization must verify:

```text
actor.organizationId == resource.organizationId
```

Do not rely only on route IDs.

## Transactions

Stock-changing workflows must have one explicit transaction boundary around the complete invariant-changing operation.

Example:

```text
BEGIN
  lock stock balance
  validate availability
  create ledger entry
  update balance
  create sale/transfer/adjustment record
  create audit event
COMMIT
```

## Concurrency

Avoid application-level locks unless necessary. Prefer PostgreSQL transactions and row-level locking.

For transfer:

- lock source and destination balances in deterministic ID order to reduce deadlocks;
- validate source available quantity;
- write outbound/inbound ledger records;
- update balances atomically.

For reservation:

- lock balance;
- calculate available = on_hand - reserved;
- reject if requested quantity > available;
- increment reserved.

## Caching

Safe cache candidates:

- category lists;
- brand lists;
- permissions metadata;
- dashboard aggregates with short TTL where stale values are acceptable.

Never cache mutable stock as authoritative truth.

## Observability

Every request should have:

- request ID;
- actor ID when authenticated;
- organization ID;
- route;
- status;
- duration.

Sensitive values must be redacted.

## Architecture evolution

If a module becomes independently scalable or has a distinct reliability boundary, propose an ADR before extracting it into a service.

## Phase 2B Core Domain Foundation

Phase 2B establishes the domain-agnostic foundation layer located at `apps/api/src/modules/core/` and `@repo/types`:

1. **Global Core Module (`CoreModule`)**:
   - Registered globally in NestJS `AppModule`.
   - Exports domain-agnostic helpers: `TenantQueryHelper`, `MoneyUtil`, `QuantityUtil`, `StateMachineUtil`.
   - Zero coupling to future business entities (Products, Warehouses, Orders remain strictly for Phase 3+).

2. **Tenant Scoping Architecture**:
   - All multi-tenant data access must route through `TenantQueryHelper.scopeToOrg(where, orgId)` or explicitly assert ownership via `assertTenantOwnership(entity, orgId)`.
   - Protects against Insecure Direct Object References (IDOR). If an entity belongs to another tenant, the API responds with 404 (`EntityNotFoundException`), never revealing the existence of cross-tenant records.

3. **Financial & Numerical Integrity**:
   - **Money**: Handled via `MoneyUtil` using exact integer minor units (paise/cents) to prevent IEEE 754 floating-point drift.
   - **Quantity**: Handled via `QuantityUtil` supporting exact 4-decimal precision using integer scaling (`bigint` internally).

4. **Lifecycle State Management**:
   - `StateMachineUtil` enforces finite state machine transitions for domain entities. Invalid transitions reject mutations before persistence.

## Phase 3A Category Foundation

Phase 3A introduces the first tenant-owned business entity within the modular monolith:

1. **Category Domain Module (`CategoriesModule`)**:
   - Located at `apps/api/src/modules/categories/`.
   - Imports `PrismaModule` and `AuditModule`.
   - Organizes business logic in `CategoriesService` and exposes HTTP transport in `CategoriesController`.
   - Completely separated from future Product/SKU domains.

2. **Tenant Scoping & Multi-Tenancy Architecture**:
   - `OrganizationGuard` validates active membership in the organization specified by `x-organization-id`.
   - All category operations (Create, List, Get, Update, Delete) are strictly bounded to `organizationId`.
   - IDOR protection ensures lookups across tenant boundaries fail safely with `CATEGORY_NOT_FOUND` (HTTP 404).

3. **Granular Authorization**:
   - Handled server-side by `PermissionsGuard` with `@RequirePermissions(...)`:
     - `category.read`, `category.create`, `category.update`, `category.delete`.

4. **Event Auditing & Traceability**:
   - State-changing actions (`category.created`, `category.updated`, `category.deleted`) emit immutable records into `AuditEvent` with sanitized metadata and correlation `requestId`.

## Phase 3B Product Domain & Database Foundation

Phase 3B introduces the central Product business entity foundation within the modular monolith:

1. **Shared Domain Contracts (`@repo/types`)**:
   - Defines canonical `UnitOfMeasure` and `ProductStatus` string union types and runtime constant value arrays (`UNIT_OF_MEASURE_VALUES`, `PRODUCT_STATUS_VALUES`).
   - Defines `ProductDto`, `CreateProductInput`, and related domain interfaces consumed by both API and frontend packages.

2. **Product Domain Module (`ProductsModule`)**:
   - Located at `apps/api/src/modules/products/`.
   - Imports `PrismaModule` and `AuditModule`.
   - Encapsulates domain operations inside `ProductsService`.
   - Strictly contains NO HTTP controllers or routes in Phase 3B; HTTP CRUD transport is cleanly deferred to Phase 3C.

3. **Domain Validation & Invariants (`ProductValidator`)**:
   - Enforces deterministic SKU normalization: trims whitespace, upper-cases string, enforces character set `[A-Z0-9._-]`, prevents internal whitespace, and caps length at 50 chars.
   - Enforces name length constraints (1–200 characters) and description constraints (optional, max 1000 characters).
   - Validates and provides fallback defaults for `UnitOfMeasure` (`UNIT`) and `ProductStatus` (`ACTIVE`).

4. **Database Engine-Level Cross-Tenant Protection**:
   - Relies on composite foreign key `Product(organizationId, categoryId) -> Category(organizationId, id)` with `ON DELETE RESTRICT`.
   - Physically guarantees at the PostgreSQL database engine level that no product can link to a category belonging to another tenant.

5. **Lifecycle State Management & Audit Log**:
   - `ProductsService.updateStatus` manages product state transitions (`ACTIVE` ↔ `INACTIVE`).
   - Mutations trigger immutable `AuditEvent` logs with `changedFields`, previous status, new status, and actor attribution.

## Phase 3C Product API Architecture

Phase 3C completes the REST API layer for Products:

1. **Thin Controller Layer (`ProductsController`)**:
   - Handles route definitions (`/api/v1/products`), parameter binding, UUID pipe validation, and guard composition.
   - Enforces authentication (`JwtAuthGuard`), tenant context (`OrganizationGuard`), and RBAC (`PermissionsGuard`).
   - Delegates all business logic, query composition, and error handling to `ProductsService`.

2. **DTO Validation & Serialization Layer**:
   - `CreateProductDto`, `UpdateProductDto`, and `QueryProductDto` provide strict type checking and transformation using `class-validator` and `class-transformer`.
   - Rejection of unknown properties (`forbidNonWhitelisted: true`) and protected fields (`id`, `organizationId`).
   - Safe sorting through `validateSortField` prevents column introspection and SQL injection.

3. **Database-Driven Query & Pagination Pipeline**:
   - Search (`name`, `sku`, `description`), filtering (`categoryId`, `status`, `unitOfMeasure`), and sorting are executed in PostgreSQL using Prisma query builders with parameterized inputs.
   - Offset pagination (`skip`/`take`) with `count` aggregation returns standard envelope with full pagination metadata.

4. **Audit Traceability**:
   - Mutations (`product.created`, `product.updated`, `product.deleted`) log immutable audit records capturing tenant, actor, changed fields, and correlation request IDs.

## Phase 5A Stock & Inventory Database & Domain Foundation

Phase 5A establishes the database and domain foundation for authoritative inventory management:

1. **Dual-Model Architecture**:
   - `StockBalance`: Current on-hand quantity per `(organizationId, productId, warehouseId)`, protected by a database unique constraint.
   - `StockLedgerEntry`: Append-only, immutable transaction log tracking all quantity deltas (`quantityBefore`, `quantityDelta`, `quantityAfter`, `type`, `referenceType`, `referenceId`, `idempotencyKey`, `createdById`).

2. **Tenant-Safe Composite Foreign Keys**:
   - Database-level composite foreign keys link `StockBalance` and `StockLedgerEntry` to `Product(organizationId, id)` and `Warehouse(organizationId, id)`.
   - Cross-tenant references (e.g. Org A Product with Org B Warehouse) are physically rejected by PostgreSQL.

3. **Exact Decimal Precision**:
   - Quantities are stored as PostgreSQL `DECIMAL(14, 4)` and enforced at 4-decimal precision via `StockQuantityValidator` and `QuantityUtil`. Floating-point operations are banned.

4. **Ledger Immutability & Architectural Boundaries**:
   - `StockFoundationService` provides read and append-only operations. No update or delete operations exist.
   - Strictly NO REST controllers or mutation APIs are implemented in Phase 5A.

5. **Negative Stock Policy**:
   - Policy is not finalized in Phase 5A and will be established in Phase 5B before stock mutation APIs are exposed.

## Phase 5B Stock Mutation Engine Architecture

Phase 5B introduces the transactional core domain engine for inventory stock mutations:

1. **Transactional Domain Service (`StockMutationService`)**:
   - Encapsulates inventory state changes (`OPENING`, `RECEIPT`, `ISSUE`, `ADJUSTMENT`) inside interactive PostgreSQL database transactions (`prisma.$transaction`).
   - Atomically updates `StockBalance` and appends immutable `StockLedgerEntry` records with strict all-or-nothing rollback guarantees.

2. **Concurrency & Locking Mechanics**:
   - Safe balance initialization via `INSERT ... ON CONFLICT ("organizationId", "productId", "warehouseId") DO NOTHING` eliminates races on nonexistent balances.
   - Exclusive row locking via `SELECT ... FOR UPDATE` serializes concurrent mutations targeting the same product and warehouse, preventing lost updates.
   - Bounded transaction retries (up to 3 attempts with exponential jitter) handle transient PostgreSQL serialization/deadlock conflicts safely.

3. **Negative Stock Prohibition**:
   - Enforces the domain invariant that on-hand stock cannot fall below zero. Mutations resulting in `newQuantity < 0` abort immediately with `StockInsufficientQuantityException`.

4. **Tenant-Scoped Idempotency & Collision Detection**:
   - Retried identical requests return the existing committed mutation without duplicate writes (`isIdempotentReplay: true`).
   - Reusing an idempotency key with conflicting mutation payloads is rejected with `StockIdempotencyConflictException`.
   - Multi-tenant key isolation allows identical idempotency keys across distinct organizations.

5. **Pure Domain Boundary**:
   - The mutation engine is internal and authoritative, serving as the sole transactional write path for stock in the system.

## Phase 5C Stock REST API Architecture

Phase 5C exposes the production Stock REST API layer conforming to strict separation of concerns:

1. **Thin Controller Protocol Adapter (`StockController`)**:
   - Acts strictly as an HTTP transport adapter located at `apps/api/src/modules/stock/stock.controller.ts`.
   - Bounded by `JwtAuthGuard`, `OrganizationGuard`, and `PermissionsGuard`.
   - Never performs stock arithmetic, database transactions, locking, or balance calculations.
   - Forwards read queries to `StockFoundationService` and mutation commands to `StockMutationService`.

2. **Route Order Collision Prevention**:
   - Static/nested routes (`balances/product/:productId`, `balances/warehouse/:warehouseId`) are declared prior to dynamic ID routes (`balances/:id`) to prevent NestJS routing collisions.

3. **Exact Decimal Protocol Enforcement**:
   - Quantity inputs (`quantityDelta`) and outputs are strictly formatted strings with 4-decimal precision (`toFixed(4)`). JavaScript numbers in payloads are rejected by DTO validators (`IsExactDecimalQuantity`) to prevent floating-point inaccuracy.

4. **Idempotency Transport Contract**:
   - Supports both `Idempotency-Key` HTTP header and request body `idempotencyKey`, enforcing consistency between them.
   - First-time executions return HTTP `201 Created`.
   - Identical retries return HTTP `200 OK` with `isIdempotentReplay: true` and the original response envelope.
   - Idempotency keys are tenant-isolated in PostgreSQL via `@@unique([organizationId, idempotencyKey])`.

5. **Tenant Isolation & IDOR Protection**:
   - Context is securely sourced from authenticated membership via `x-organization-id`.
   - Lookups across tenant boundaries return HTTP `404 Not Found`. Mass assignment of tenant fields is rejected with HTTP `400 Bad Request`.

## Phase 6A Purchase Order / Procurement Foundation Architecture

Phase 6A establishes the domain and persistence foundation for procurement via the `PurchaseOrder` aggregate:

1. **Purchase Order Aggregate & Tenant Boundaries**:
   - The aggregate root is `PurchaseOrder` containing child entity collection `PurchaseOrderLine[]`.
   - Tenant safety is enforced at the database level via composite foreign keys:
     - `PurchaseOrder.warehouse` -> `Warehouse(organizationId, id)` (`onDelete: Restrict`)
     - `PurchaseOrderLine.purchaseOrder` -> `PurchaseOrder(organizationId, id)` (`onDelete: Cascade`)
     - `PurchaseOrderLine.product` -> `Product(organizationId, id)` (`onDelete: Restrict`)
   - Cross-tenant references are rejected at the PostgreSQL engine level.

2. **Decoupled Stock Boundary**:
   - Purchase Orders represent **intent to purchase**, not physical inventory receipt.
   - Creating, submitting, or approving a Purchase Order does **NOT** alter `StockBalance` and does **NOT** write `StockLedgerEntry` records.
   - Stock increases will occur strictly during future goods receipt workflows invoking `StockMutationService.executeMutation({ type: 'RECEIPT', ... })`.

3. **Centralized Deterministic State Machine**:
   - Status transitions follow `DRAFT → SUBMITTED → APPROVED → PARTIALLY_RECEIVED → RECEIVED → CLOSED` (with explicit `CANCELLED` states).
   - Governed by `PurchaseOrderStateMachine` and `StateMachineUtil`. Illegal transitions fail with `PurchaseOrderInvalidTransitionException`.

4. **Authoritative Monetary & Quantity Arithmetic**:
   - Fixed-point PostgreSQL `DECIMAL(14, 4)` is used for all monetary values (`unitPrice`, `lineTotal`, `subtotal`, `taxTotal`, `grandTotal`) and quantities.
   - Line totals and order subtotals are calculated authoritatively server-side using `Prisma.Decimal` arbitrary-precision arithmetic. Client-supplied totals are rejected/ignored.
   - PostgreSQL check constraints enforce non-negative prices, positive quantities, and exact total parity.

5. **Atomic Transactional Boundary**:
   - Creation of a Purchase Order along with its lines executes within an atomic Prisma transaction (`prisma.$transaction`). Failure on any line rolls back the entire aggregate.

## Phase 6D Purchase Order Receiving & Inventory Integration Architecture

1. **Controlled Transactional Bridge**:
   - The boundary between procurement intent (`PurchaseOrder`) and physical inventory (`StockBalance` / `StockLedgerEntry`) is bridged strictly via `POST /api/v1/purchase-orders/:id/receive`.
   - The entire receiving workflow executes inside a single outer interactive transaction (`prisma.$transaction(async (tx) => { ... })`). There are zero split transactions or detached stock updates.
   - Authoritative inventory mutation is performed solely through `StockMutationService.mutateStockTx(tx, ...)` with `type: 'RECEIPT'`, referenceType `'PURCHASE_ORDER'`, referenceId `purchaseOrder.id`.

2. **Concurrency & Race Condition Safety**:
   - Explicit PostgreSQL row locks (`SELECT ... FOR UPDATE`) are acquired inside the transaction for:
     - The `PurchaseOrder` row
     - All `PurchaseOrderLine` rows for that purchase order
     - Target `StockBalance` rows (locked within `StockMutationService.mutateStockTx`)
   - Concurrent receipt requests serialize deterministically. If multiple requests attempt to receive simultaneously, PostgreSQL row-level locks prevent over-receiving, duplicate receipt numbers, or race conditions.

3. **Zero Over-Receiving Invariant**:
   - Over-receiving beyond the line's ordered quantity is strictly disallowed:
     `currentReceived + quantityToReceive <= quantityOrdered`
   - Enforced at three levels:
     - API payload validation (`quantity > 0`, 4 decimal places)
     - Application transaction validation with locked rows (`PurchaseOrderOverReceiptException`)
     - Database-level check constraint on `PurchaseOrderLine`: `CHECK ("receivedQuantity" <= "quantity")`

4. **Audit Trail & GoodsReceipt Aggregate**:
   - Every receipt creates an immutable `GoodsReceipt` audit record with sequential numbering (`GR-<PO_NUMBER>-<SEQUENCE>`), receiving timestamp, actor ID, and child `GoodsReceiptLine` records.
   - Database-level check constraint ensures `GoodsReceiptLine.quantityReceived > 0`.
   - An `AuditEvent` is persisted transactionally with action `'purchase-order.received'`, capturing PO number, goods receipt ID, receipt number, previous status, new status, and line items received.

5. **State Machine Progressions**:
   - When some lines or partial quantities are received: transitions to `PARTIALLY_RECEIVED`.
   - When all lines are fully received (`receivedQuantity >= quantity` on every line): transitions to `RECEIVED`.
   - Idempotent replays preserve current order state without re-mutating stock or re-updating lines.

6. **Stock Ledger Reference Semantics & Traceability**:
   - **Primary Reference**: `referenceType: 'PURCHASE_ORDER'`, `referenceId: purchaseOrder.id`. This intentionally anchors the inventory ledger to the authoritative commercial procurement contract, ensuring backward compatibility across all financial and purchasing reporting.
   - **Operational Traceability**: Exact receipt execution is unambiguously tracked in `StockLedgerEntry.metadata`:
     ```json
     {
       "purchaseOrderNumber": "PO-2026-0001",
       "purchaseOrderLineId": "<uuid>",
       "goodsReceiptId": "<uuid>",
       "goodsReceiptNumber": "GR-PO-2026-0001-1"
     }
     ```
   - **Bidirectional Traceability**: Any `StockLedgerEntry` can be resolved immediately to its corresponding `GoodsReceipt` via `metadata.goodsReceiptId`, and any `GoodsReceipt` line maps directly to its ledger entry via `referenceId = purchaseOrder.id` and `metadata.goodsReceiptId = receipt.id`.
