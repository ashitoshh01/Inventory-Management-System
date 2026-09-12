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
