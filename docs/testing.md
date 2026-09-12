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

- **Test Execution**:
  ```bash
  # Run all API unit and integration tests
  pnpm --filter @repo/api test

  # Run API E2E tests against PostgreSQL test database
  pnpm --filter @repo/api test:e2e
  ```
