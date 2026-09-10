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
