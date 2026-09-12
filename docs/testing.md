# Testing Strategy

## Test pyramid

```text
             E2E
          /       \
       Integration
      /             \
     Unit / Domain / Contract
```

Do not make every test E2E.

## Unit tests

Test pure business rules:

- stock availability;
- reorder calculations;
- expiry classification;
- transfer state transitions;
- return eligibility;
- price calculations;
- permission policies.

## Integration tests

Use a real PostgreSQL test database/container for:

- stock transactions;
- constraints;
- unique keys;
- warehouse tenant isolation and compound constraints;
- locking/concurrency;
- repository behavior;
- authorization with tenant scoping.

Mocks alone cannot prove database correctness.

## Concurrency tests

At least one test should simulate two simultaneous attempts to consume the same stock.

Expected:

- total stock never becomes negative;
- one operation may succeed and the other fails/retries according to policy;
- ledger and balance remain consistent.

## E2E critical flows

1. login
2. create product
3. receive purchase order
4. view stock
5. adjust stock
6. transfer stock
7. create sale
8. process return
9. low-stock notification
10. role restriction
11. audit log
12. import/export

## API contract tests

Verify:

- validation;
- response shape;
- error codes;
- authentication;
- permission requirements;
- pagination.

## Frontend tests

Test:

- table filters;
- forms;
- validation;
- loading/empty/error states;
- permission-based UI;
- destructive confirmation;
- keyboard navigation.

## Performance tests

Before production:

- load test normal reads;
- load test stock mutation;
- test dashboard endpoints;
- test exports separately;
- measure p50/p95/p99;
- inspect DB query plans.

Initial target:

- 100 concurrent active users;
- p95 common API < 500 ms under expected workload.

## Regression rule

Every production bug should result in:

1. a test that reproduces it;
2. a fix;
3. a test proving the fix.

## Phase 2B Testing Conventions

Phase 2B implements rigorous testing across domain utilities, safety filters, and E2E endpoints:

- **Domain Utility Unit Tests**:
  - `money.util.spec.ts`: Validates integer minor unit conversions, string-based exact arithmetic, addition, subtraction, division, and rounding behavior without floating point drift.
  - `quantity.util.spec.ts`: Validates 4-decimal precision, fractional scale factors, additions, subtractions, and comparisons.
  - `state-machine.util.spec.ts`: Validates deterministic state transition validation, terminal state enforcement, and transition metadata.
  - `tenant-query.helper.spec.ts`: Validates multi-tenant query filter composition, ownership assertions, and IDOR prevention exceptions.
  - `pagination.dto.spec.ts`: Validates pagination query transformations, clamping logic, and sort whitelist verification.
  - `all-exceptions.filter.spec.ts`: Validates sanitization and HTTP status code mappings for Prisma exceptions (`P2002`, `P2003`, `P2025`) and domain exceptions.

- **E2E Core Domain Tests**:
  - `core-domain.e2e-spec.ts`: Executes against a live PostgreSQL test database to verify real Prisma constraint error interception, database error sanitization, and tenant query scoping under full HTTP lifecycle.

## Phase 3A Testing — Category Foundation

Phase 3A introduces dedicated unit and end-to-end integration tests:

- **Category DTO Unit Tests (`category.dto.spec.ts`)**:
  - Validates class-transformer whitespace trimming.
  - Verifies required name constraints and rejection of empty or whitespace-only names.
  - Verifies max length constraints (name: 100 chars, description: 500 chars).
  - Verifies strict rejection of unknown properties and injection attempts (e.g. `organizationId`).
  - Verifies sort field allowlist safety (`name`, `createdAt`, `updatedAt`).

- **Category Service Unit Tests (`categories.service.spec.ts`)**:
  - Verifies case-insensitive duplicate rejection (`CATEGORY_DUPLICATE`).
  - Verifies tenant-scoped queries, pagination metadata, and search filters.
  - Verifies scoped lookups and 404 behavior for nonexistent or cross-tenant records.
  - Verifies field updates and rename collision prevention.
  - Verifies deletion, foreign key restriction mapping (`CATEGORY_DELETE_CONFLICT`), and audit event creation.

- **Category E2E Tests (`categories.e2e-spec.ts`)**:
  - 25 end-to-end integration tests against real PostgreSQL database.
  - Covers creation, listing with pagination & search, single get, updates, and deletion.
  - Tests IDOR prevention: User from Org A attempting to access/update/delete an Org B category gets 404.
  - Tests authorization: verifying `category.read`, `category.create`, `category.update`, `category.delete` enforcement.
  - Tests suspended membership and missing header rejections.
  - Tests immutable `AuditEvent` generation with sanitized metadata and correlation ID propagation.

- **Test Execution**:
  ```bash
  # Run Category unit tests
  pnpm --filter @repo/api test src/modules/categories/

  # Run Category E2E tests
  pnpm --filter @repo/api test test/categories.e2e-spec.ts

  # Run complete test suite across monorepo
  pnpm test
  ```

## Phase 3B Testing — Product Domain & Database Foundation

Phase 3B introduces comprehensive unit tests for product domain invariants and real database integration tests:

- **Product Validator Unit Tests (`products.validator.spec.ts`)**:
  - Validates SKU normalization: trimming leading/trailing whitespace, uppercasing alphanumeric characters, rejecting internal whitespace (spaces, tabs, newlines), enforcing max 50 characters, and rejecting disallowed punctuation (e.g. `@`, `#`, `$`, `/`).
  - Validates product name rules: string check, whitespace trimming, non-empty requirement, and 200-character upper bound.
  - Validates product description rules: optional handling (`null` on omitted or blank strings), whitespace trimming, and 1000-character boundary.
  - Validates Unit of Measure: default assignment to `'UNIT'`, case-insensitive canonical normalization, and rejection of invalid string values.
  - Validates Product Status: default assignment to `'ACTIVE'`, case-insensitive canonical normalization, and rejection of invalid status values.

- **Product Service Unit Tests (`products.service.spec.ts`)**:
  - Tests `create`: verifies category ownership verification, SKU uniqueness check, field normalization, entity persistence, and immutable audit event logging with metadata.
  - Tests error handling in `create`: rejects empty organization or category context, rejects foreign-tenant category with `InvalidCategoryReferenceException`, rejects duplicate SKU with `ProductDuplicateSkuException`, and catches Prisma `P2003`/`P2002` violations.
  - Tests `findById` and `findBySku`: verifies scoped lookups, SKU query normalization, and null returns for cross-tenant or nonexistent records.
  - Tests `updateStatus`: validates status updates, transition audit events, and 404 handling on nonexistent products.

- **Product Database & Integration Tests (`products.integration.spec.ts`)**:
  - Executes against real PostgreSQL test database.
  - Verifies cross-tenant category linking rejection at the application service level (`InvalidCategoryReferenceException`).
  - Verifies engine-level composite foreign key constraint violation (`P2003`) when attempting raw cross-tenant insertion directly via Prisma client (`Product_organizationId_categoryId_fkey`).
  - Verifies intra-organization SKU uniqueness rejection on duplicate and case-variant SKUs.
  - Verifies inter-organization SKU coexistence (Org A and Org B creating products with identical SKU `BOLT-10MM`).
  - Verifies tenant isolation in `findById` and `findBySku`.
  - Verifies status updates and corresponding `AuditEvent` records in PostgreSQL.
  - Verifies `ON DELETE RESTRICT` prevention of category deletion when referenced by a product.
  - Verifies organization cascade deletion cleans up associated products.

- **Test Execution**:
  ```bash
  # Run Product unit tests
  pnpm --filter @repo/api test src/modules/products/

  # Run Product integration tests against PostgreSQL
  pnpm --filter @repo/api test test/products.integration.spec.ts

  # Run entire workspace test suite
  pnpm test
  ```

## Phase 3C Testing — Product API Implementation

Phase 3C establishes end-to-end API verification and expanded unit test suites:

- **Product DTO Unit Tests (`product.dto.spec.ts`)**:
  - 15 tests covering `CreateProductDto`, `UpdateProductDto`, and `QueryProductDto`.
  - Verifies class-transformer trimming, non-empty name and SKU validation, max length bounds.
  - Verifies UUIDv4 validation for `categoryId`, enum inclusion for `unitOfMeasure` and `status`.
  - Verifies rejection of protected fields (`id`, `organizationId`) and unknown properties.
  - Verifies query parameter parsing, integer conversion, and sort allowlist fallback.

- **Product Controller Unit Tests (`products.controller.spec.ts`)**:
  - 6 tests validating controller routing, request/tenant parameter extraction, and delegation to `ProductsService`.

- **Product Service Unit Tests (`products.service.spec.ts`)**:
  - 23 tests validating all domain operations:
    - Creation, category ownership, SKU normalization, intra-tenant duplicate SKU prevention, Prisma P2002/P2003 handling, audit event creation.
    - Database-driven listing (`findAll`) with search, category filtering, status filtering, UOM filtering, and safe sorting.
    - Scoped single lookups (`findOne`, `getBySku`, `findById`, `findBySku`).
    - Updates (`update`) with category reassignment check, SKU renaming duplicate check, and audit logging.
    - Deletions (`delete`) with referential integrity conflict mapping (`ProductDeleteConflictException`) and audit logging.

- **Product E2E Integration Tests (`products.e2e-spec.ts`)**:
  - 36 real PostgreSQL HTTP integration tests:
    - **Creation**: Valid product creation, audit event persistence, normalized SKU, required field checks, invalid SKU format rejection, unknown field rejection, cross-tenant category rejection (`400 Bad Request`), duplicate SKU rejection (`409 Conflict`), identical SKU in different organization (`201 Created`).
    - **Authentication & RBAC**: Unauthenticated requests return `401 Unauthorized`, missing `x-organization-id` returns `400 Bad Request`, missing permissions (`product.create`, `product.update`, `product.delete`) return `403 Forbidden`.
    - **Listing, Pagination & Search**: Paginated product list with metadata envelope, multi-field search (`name`, `sku`, `description`), SQL injection safety strings (`' OR '1'='1`, semicolons, wildcards), category filtering, status filtering, UOM filtering, allowlisted sorting, and safe fallback on arbitrary sort fields.
    - **IDOR Immunity**: Accessing, updating, or deleting another organization's product ID returns `404 Not Found` (`PRODUCT_NOT_FOUND`).
    - **Lookup by SKU**: Case-insensitive SKU resolution within active tenant, `404 Not Found` across tenant boundaries.
    - **Update**: Attribute updates, category reassignment to valid same-org category, rejection of foreign category reassignment, duplicate SKU rename collision rejection.
    - **Delete**: Successful deletion with audit event emission, verification of database removal, `404 Not Found` on subsequent delete attempts.

- **Test Execution**:
  ```bash
  # Run all Product unit tests (DTO, validator, service, controller)
  pnpm --filter @repo/api test src/modules/products/

  # Run Product E2E tests against PostgreSQL
  pnpm --filter @repo/api test test/products.e2e-spec.ts

  # Run full monorepo test suite
  pnpm test
  ```

## Phase 3D & 3E Testing — Product Management UI & UX Refinement

Phase 3D & 3E establish frontend React component, hook, and integration testing with Vitest and React Testing Library:

- **Frontend Test Suites (`apps/web`)**:
  - `product-list.test.tsx`:
    - Loading/skeleton layout validation.
    - Product rendering with dense tabular typography and category/status badges.
    - Empty states (distinguishing empty organization from zero search/filter results).
    - Error state with user-friendly copy and actionable "Retry" refetch execution.
    - 300ms search debounce, Escape key reset, and clear search button.
    - Active filter badges with individual removal buttons and reset all.
    - Interactive sortable table headers (SKU, Product, Unit, Status, Created) with mouse and keyboard (Enter/Space) activation and `aria-sort` verification.
    - Pagination range formatting (`Showing X–Y of Z results` with en-dash) and direct page buttons (`aria-current="page"`).
    - Action dropdown triggers with accessible `aria-label` identifying the specific product SKU.
    - Permission-aware UI hiding creation and editing controls when unauthorized.
    - Full page integration: URL search parameter initialization, bi-directional synchronization, and post-deletion page auto-recovery.
  - `new-product-page.test.tsx`: Dedicated `/products/new` page rendering, navigation back, form submission via `useCreateProduct`, and error toast feedback.
  - `product-create.test.tsx`: Form dialog validation, category selection, duplicate SKU error mapping, and optimistic submission states.
  - `product-edit.test.tsx`: Initial field hydration, update mutation, conflict mapping, and navigation.
  - `product-details.test.tsx`: Detailed product card, audit timestamp rendering, not-found error boundary, and action dispatch.
  - `product-delete.test.tsx`: Confirmation modal, destructive button styling, 403 forbidden error handling, and 409 conflict handling.
  - `use-products.test.tsx`: Multi-tenant query key isolation, cache invalidation, and TanStack Query behavior across organization switches.
  - `client.test.ts`: HTTP client interceptors, error mapping, and request headers.

- **Test Execution**:
  ```bash
  # Run frontend test suite
  pnpm --filter @repo/web test

  # Run full monorepo quality gates
  pnpm format:check
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  ```

## Phase 3F Testing — Product Security & Final QA

Phase 3F expands the test suite to explicitly prove security invariants and production readiness:

- **Security & Tenancy Hardening E2E Tests (`products.e2e-spec.ts`)**:
  - `Header Tampering / Spoofing`: Asserts that providing a foreign `x-organization-id` header returns HTTP 403 `FORBIDDEN` via `OrganizationGuard`.
  - `Cross-Tenant SKU Isolation`: Asserts that querying another organization's SKU via `/api/v1/products/sku/:sku` returns HTTP 404 `PRODUCT_NOT_FOUND`.
  - `Search Tenant Isolation`: Asserts that catalog search queries (`/api/v1/products?search=...`) never return records from other organizations.
  - `Audit Log Sanitization`: Verifies that sensitive credentials (passwords, tokens, authorization headers, cookies, connection strings) are strictly redacted to `[REDACTED]` prior to persistence in `AuditEvent`.
  - `Concurrent Race Invariance`: Simulates concurrent duplicate SKU insertions. Proves that exactly one insertion succeeds while simultaneous duplicates are safely caught by unique constraints and translated to HTTP 409 `PRODUCT_DUPLICATE_SKU`.

## Phase 5A Testing — Stock & Inventory Database & Domain Foundation

Phase 5A establishes domain unit and PostgreSQL database integration testing for inventory:

- **Domain Unit Tests (`stock.quantity.spec.ts`)**:
  - Precision validation: Exact 4-decimal support (`0`, `1`, `1.25`, `0.0001`, `12345.6789`).
  - Precision enforcement: Rejection of fractional units exceeding 4 decimal places (`0.00001`, `1.12345`).
  - Delta validation: Rejection of zero-quantity deltas.
  - Ledger math validation: Verifies that `quantityAfter` must strictly equal `quantityBefore + quantityDelta`.

- **PostgreSQL Database Integration Tests (`stock.integration.spec.ts`)**:
  - **Test A**: Same-tenant Product + Warehouse -> StockBalance successfully created in PostgreSQL.
  - **Test B**: Cross-tenant Product reference -> Rejected by composite foreign key `StockBalance_organizationId_productId_fkey`.
  - **Test C**: Cross-tenant Warehouse reference -> Rejected by composite foreign key `StockBalance_organizationId_warehouseId_fkey`.
  - **Test D**: Duplicate StockBalance -> Rejected by composite unique index `StockBalance_organizationId_productId_warehouseId_key`.
  - **Test E**: Exactly one balance exists per product per warehouse within an organization.
  - **Test F**: Same product in different warehouses -> Permitted.
  - **Test G**: Different products in same warehouse -> Permitted.
  - **Test H**: Identical SKU in different organizations -> Completely isolated multi-tenant balances.
  - **Test I**: Organization cascade deletion -> Cascades to stock balances and ledger records.
  - **Test J**: Product deletion restriction -> Prohibited when stock records exist (`onDelete: Restrict`).
  - **Test K**: Warehouse deletion restriction -> Prohibited when stock records exist (`onDelete: Restrict`).
  - **Test L**: Ledger foreign-key integrity -> Cross-tenant references on `StockLedgerEntry` rejected.
  - **Immutability Invariant**: Verifies that `StockFoundationService` provides no update/delete methods on ledger entries.
  - **Exact Quantity Persistence**: Decimal exactness verified without IEEE 754 floating-point errors.
  - **Idempotency Key Constraints**: Unique per organization; identical key across different organizations allowed; multiple `null` keys allowed.
  - **Database Check Constraints**: PostgreSQL engine rejects zero deltas (`StockLedgerEntry_delta_nonzero`) and arithmetic inconsistencies (`StockLedgerEntry_math_consistent`).

## Phase 5B Testing — Stock Mutation Engine

Phase 5B establishes unit testing and real PostgreSQL concurrency integration tests for the mutation engine:

- **Unit Tests (`stock.quantity.spec.ts` & `stock-mutation.service.spec.ts`)**:
  - Mutation delta direction validation: `OPENING` (>0), `RECEIPT` (>0), `ISSUE` (<0), `ADJUSTMENT` (!= 0).
  - Exact fixed-point addition and subtraction.
  - Strict non-negative quantity assertions.
  - Pre-transaction tenant, product, and warehouse validation.
  - In-memory idempotency replay and conflict detection.

- **PostgreSQL Concurrency & Transaction Integration Tests (`stock-mutation.integration.spec.ts`)**:
  - **Core Operations**: Verifies `OPENING`, `RECEIPT`, `ISSUE`, and `ADJUSTMENT` mutations against real PostgreSQL tables.
  - **Negative Stock Prohibition**: Rejects issue operations exceeding current balance; confirms zero ledger or balance side-effects.
  - **All-or-Nothing Rollback Atomicity**: Proves that transaction failures at any point roll back both `StockBalance` updates and `StockLedgerEntry` writes.
  - **Concurrency — Issue Serialization**: Simulates concurrent issues (`-30` and `-50` on starting `100`); proves exact final balance `20.0000` with 2 ledger entries and zero lost updates.
  - **Concurrency — Receipt Serialization**: Simulates concurrent receipts (`+25` and `+40` on starting `100`); proves exact final balance `165.0000`.
  - **Concurrency — Mixed Operations**: Simulates concurrent receipt and issue (`+25` and `-40` on starting `100`); proves exact final balance `85.0000`.
  - **Concurrency — First-Balance Race**: Simulates concurrent mutations against a nonexistent balance; proves exactly one `StockBalance` is created with the correct aggregated quantity.
  - **Concurrency — Duplicate Idempotency Key Race**: Proves that simultaneous requests with the same idempotency key commit exactly one mutation.
  - **Idempotency Contract**: Proves identical retries return cached result without duplicate ledger entries; proves key reuse with differing payload throws `StockIdempotencyConflictException`.
  - **Audit Integration**: Verifies `AuditEvent` records are emitted upon successful mutation commit and omitted on rolled-back transactions.

## Phase 5C Testing — Stock REST API

Phase 5C establishes comprehensive unit testing and real PostgreSQL E2E HTTP verification for the Stock REST API layer:

- **Stock DTO Unit Tests (`stock.dto.spec.ts`)**:
  - 22 unit tests validating `CreateStockMutationDto`, `QueryStockBalanceDto`, and `QueryStockLedgerDto`.
  - Verifies exact decimal string enforcement (`IsExactDecimalQuantity`), rejecting JavaScript numbers, 5-decimal numbers, zero values, and non-numeric strings.
  - Verifies required field presence, UUIDv4 validation, and mutation type enum constraints.
  - Verifies bounded length and regex format on idempotency keys.
  - Verifies mass assignment prevention rejecting client injection of `organizationId`, `actorId`, `quantityBefore`, etc.
  - Verifies strict sort allowlists (`ALLOWED_STOCK_BALANCE_SORT_FIELDS`, `ALLOWED_STOCK_LEDGER_SORT_FIELDS`) and safe fallback helpers.

- **Stock Controller Unit Tests (`stock.controller.spec.ts`)**:
  - 12 unit tests validating thin controller protocol mediation:
    - Verifies delegation of query endpoints to `StockFoundationService`.
    - Verifies balance and ledger lookup error handling (404 mapping).
    - Verifies delegation of `mutate` to `StockMutationService`.
    - Verifies idempotency header/body reconciliation (rejecting mismatches with `400 Bad Request`).
    - Verifies HTTP status mapping (`201 Created` for new mutations, `200 OK` for idempotent replays).

- **Stock Foundation Service Unit Tests (`stock-foundation.service.spec.ts`)**:
  - 10 unit tests validating tenant-scoped query methods:
    - `findById` scoping and null handling.
    - `findPaginatedBalances` filter construction, sorting, and pagination metadata envelopes.
    - `findByProduct` and `findByWarehouse` tenant verification and 404 domain error throwing.
    - `findPaginatedLedger` and `findLedgerById` scoping and null handling.

- **Stock PostgreSQL E2E Tests (`stock.e2e-spec.ts`)**:
  - 32 end-to-end HTTP integration tests against PostgreSQL:
    - **Authentication**: `401 Unauthorized` on unauthenticated requests across all stock endpoints.
    - **Authorization & RBAC**: `403 Forbidden` on missing `stock.read`, missing `stock.mutate`, or tenant spoofing via `x-organization-id`.
    - **Core Mutation Lifecycle**: Executes full `OPENING` -> `RECEIPT` -> `ISSUE` -> `ADJUSTMENT` lifecycle, verifying PostgreSQL balances and ledger rows at each step; verifies `409 Conflict` (`STOCK_INSUFFICIENT_QUANTITY`) when stock is insufficient.
    - **Idempotency Contract**: Verifies `201 Created` on first execution, `200 OK` on identical replay without duplicate ledger creation, `409 Conflict` on payload modification, `400 Bad Request` on header/body key mismatch, and cross-tenant key isolation.
    - **Concurrency E2E**: Real simultaneous supertest HTTP requests executing concurrent issues with zero lost updates.
    - **Tenant Isolation (IDOR)**: Verifies `404 Not Found` when accessing cross-tenant balance IDs, mutating cross-tenant products, querying cross-tenant product/warehouse balances, or querying cross-tenant ledger IDs.
    - **Pagination, Filtering & Sorting**: Verifies limit clamping, page metadata (`hasNextPage`, `totalPages`), productId/warehouseId/type filters, ascending/descending sorting, and rejection of malicious sort fields with `400 Bad Request`.
    - **Validation & Mass Assignment**: Rejects number quantities, 5-decimal places, zero quantities, and protected field injection.
    - **Audit Trail**: Verifies tenant-scoped `stock.mutated` audit record on success and absence of misleading audit on failure.

- **Test Execution**:
  ```bash
  # Run Stock unit tests
  pnpm --filter @repo/api test src/modules/stock/

  # Run Stock E2E tests against PostgreSQL
  pnpm --filter @repo/api test test/stock.e2e-spec.ts

  # Run complete workspace test suite
  pnpm test
  ```

## Phase 5D Testing — Stock Management UI

Phase 5D establishes frontend React unit and component testing for stock management under Vitest and React Testing Library:

- **Stock API Client Tests (`apps/web/src/lib/api/__tests__/stock.test.ts`)**:
  - `listBalances()` query string serialization with filter parameters (`productId`, `warehouseId`, `sortBy`, `sortOrder`, `page`, `limit`).
  - `getBalanceById()` single balance retrieval by ID.
  - `getBalancesByProduct()` and `getBalancesByWarehouse()` scoped balance queries.
  - `mutate()` sends `POST /stock/mutations` with exact payload and dual `Idempotency-Key` header and payload contract.
  - Verification of `ApiError` throwing on HTTP errors (e.g. `INSUFFICIENT_STOCK`) and network failures.
  - **Frontend Security Boundary**: Explicitly asserts `process.env.DATABASE_URL` is undefined, preventing client-side database driver or connection leakage.

- **Stock TanStack Query Hooks Tests (`apps/web/src/hooks/__tests__/use-stock.test.tsx`)**:
  - Validates strict tenant cache isolation: query keys for Organization A (`stockKeys.all('org-A')`) and Organization B (`stockKeys.all('org-B')`) are strictly decoupled.
  - `useStockBalances` fetches balance listings for active organization.
  - `useStockBalance` fetches individual balance records by ID.
  - `useProductStock` and `useWarehouseStock` fetch scoped entity balance listings.
  - `useStockMutation` invalidates all tenant-scoped stock query caches on mutation success.

- **Stock Balance Table Component Tests (`apps/web/src/components/stock/__tests__/stock-balance-table.test.tsx`)**:
  - Loading skeleton state rendering when `isLoading = true`.
  - Error empty state with actionable retry handler when `isError = true`.
  - Empty states differentiating between zero organization balances and zero filter matches.
  - Product and warehouse entity name/SKU/code resolution.
  - Exact 4-decimal quantity string display without rounding distortion; "Zero Stock" badge display on zero quantities.
  - Interactive table header column sorting (`onSort`).
  - Mutate action button dispatch (`onMutateStock`).

- **Stock Mutation Dialog Component Tests (`apps/web/src/components/stock/__tests__/stock-mutation-dialog.test.tsx`)**:
  - Form dialog rendering with required controls and options.
  - Strict input validation rejecting empty quantities, zero quantities, and numbers with >4 decimal places.
  - Confirmation review step displaying exact formatted decimal quantities and direction sign (`RECEIPT (+)` vs `ISSUE (-)`).
  - Generation of cryptographically random UUID idempotency keys per session.
  - Submission execution via `stockApi.mutate` and double-click protection while `isPending`.
  - Handling of successful mutations and display of `isIdempotentReplay: true` notifications.

- **Test Execution**:
  ```bash
  # Run Stock UI component and hook tests
  pnpm --filter @repo/web test src/components/stock/ src/hooks/__tests__/use-stock.test.tsx src/lib/api/__tests__/stock.test.ts

  # Run full monorepo quality gates
  pnpm format:check
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  ```

## Phase 5E Testing — Stock Ledger / History UI

Phase 5E establishes comprehensive frontend React unit and component testing for the stock ledger / history UI under Vitest and React Testing Library:

- **Stock Ledger API Client Tests (`apps/web/src/lib/api/__tests__/stock-ledger.test.ts`)**:
  - `listLedger()` query string serialization with filter parameters (`productId`, `warehouseId`, `type`, `sortBy`, `sortOrder`, `page`, `limit`).
  - `listLedger()` execution with empty parameters returning default paginated listings.
  - `getLedgerById()` single immutable ledger record retrieval by ID.
  - Verifies exact string decimal preservation (`quantityDelta`, `quantityBefore`, `quantityAfter`) without floating-point conversion loss.
  - `ApiError` propagation on 404 not found or server failures.
  - **Frontend Security Boundary**: Explicit assertion that `process.env.DATABASE_URL` is undefined, verifying complete client-server separation.

- **Stock Ledger TanStack Query Hooks Tests (`apps/web/src/hooks/__tests__/use-stock-ledger.test.tsx`)**:
  - Validates tenant query key isolation: ledger query keys for Organization A (`stockKeys.ledgerList('org-A')`) and Organization B (`stockKeys.ledgerList('org-B')`) are strictly decoupled.
  - `useStockLedger` queries `stockApi.listLedger` with active tenant and filters.
  - `useStockLedgerEntry` queries `stockApi.getLedgerById` with active tenant and record ID.
  - `useStockLedgerEntry` remains idle when record ID is undefined.

- **Stock Ledger Table Component Tests (`apps/web/src/components/stock/__tests__/stock-ledger-table.test.tsx`)**:
  - Loading skeleton state rendering when `isLoading = true`.
  - Error state with actionable retry button when `isError = true`.
  - Empty states distinguishing between an empty ledger vs. zero filter matches.
  - Resolution and rendering of products, warehouses, and formatted timestamps.
  - Exact signed decimal delta formatting (`+25.5000` in emerald, `-10.2500` in amber).
  - Exact monospace display of before-and-after balance transitions (`100.0000 → 125.5000`).
  - Interactive table header column sorting triggering `onSort` with allowlisted fields.

- **Stock Ledger Detail Card Component Tests (`apps/web/src/components/stock/__tests__/stock-ledger-detail.test.tsx`)**:
  - Renders immutable audit notice banner and entry identifiers.
  - Displays mathematical consistency breakdown (`Balance Before + Delta = Balance After`) using exact decimals.
  - Renders resolved product and warehouse details with external navigation links.
  - Displays audit metadata: reference, notes, idempotency key, and creator identity (or "System (Automated)" when null).
  - **INVARIANT VERIFICATION**: Strictly asserts the complete absence of edit, mutate, reverse, update, or delete controls.

- **Test Execution**:
  ```bash
  # Run Stock Ledger UI component and hook tests
  pnpm --filter @repo/web test src/components/stock/__tests__/stock-ledger-*.test.tsx src/hooks/__tests__/use-stock-ledger.test.tsx src/lib/api/__tests__/stock-ledger.test.ts

  # Run full monorepo quality gates
  pnpm format:check
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  ```

## Phase 5F Testing — Stock Security & Adversarial QA

Phase 5F establishes rigorous adversarial security and concurrency test suites against real PostgreSQL and HTTP endpoints:

- **Stock Security Adversarial E2E Suite (`apps/api/test/stock-security.e2e-spec.ts`)**:
  - **Multi-Tenant Isolation**: Proves that an authenticated user in Organization A cannot access balances, ledger entries, or perform mutations on Organization B resources (returns uniform 404s).
  - **Header Spoofing**: Confirms that spoofing `x-organization-id` with another organization's ID without membership is unconditionally blocked with HTTP 403 `Forbidden`.
  - **IDOR Protection**: Verifies that non-existent UUIDs, cross-tenant UUIDs, and malformed strings cannot be enumerated or exploited for path traversal.
  - **Server-Side RBAC**: Validates token absence, token expiration, unprivileged roles (403), reader-only roles (read 200, mutate 403), and mutator-only roles (mutate 201, read 403).
  - **Mass Assignment & Strict Protocol**: Validates rejection of injected fields (`organizationId`, `quantityBefore`, `quantityAfter`) and non-string numeric quantities.
  - **SQL Injection & Pagination Abuse**: Rejects SQL injection in query parameters, proto pollution in sort fields, and out-of-bounds pagination (`page <= 0`, `limit <= 0`, `limit > 100`).
  - **Ledger Immutability & Error Sanitization**: Confirms absence of `PUT`/`PATCH`/`DELETE` ledger routes and ensures zero database URLs or stack traces are leaked in error responses.

- **Stock Concurrency, Atomicity & Decimal Math Suite (`apps/api/test/stock-concurrency-adversarial.spec.ts`)**:
  - **Concurrent Issue Races**: Proves that 10 concurrent requests of `-15.0000` against stock `100.0000` safely apply exactly 6 mutations, rejecting 4 with `StockInsufficientQuantityException`, leaving balance strictly `>= 0`.
  - **Exhaustion Race**: Proves 20 concurrent requests of `-10.0000` against stock `100.0000` resolve with zero negative balance and zero lost updates.
  - **First-Balance Creation Race**: Proves 10 concurrent receipt mutations starting with zero initial balance rows create exactly one `StockBalance` row with correct cumulative balance and 10 ledger rows.
  - **Idempotency Race**: Proves 20 concurrent identical requests with the same key execute the mutation exactly once, while same key with altered payload fails with HTTP 409 conflict.
  - **Atomicity & Rollback**: Asserts database state before and after simulated failures to prove zero partial balance updates or orphan ledger entries.
  - **Mathematical Invariant**: Uses `Prisma.Decimal` to verify `quantityAfter = quantityBefore + quantityDelta` across all ledger rows and proves the sum of all deltas strictly equals the authoritative balance.

- **Test Execution**:
  ```bash
  # Run Phase 5F Security and Concurrency Suites
  pnpm --filter @repo/api test test/stock-security.e2e-spec.ts
  pnpm --filter @repo/api test test/stock-concurrency-adversarial.spec.ts

  # Run full monorepo quality gates
  pnpm format:check
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  ```
