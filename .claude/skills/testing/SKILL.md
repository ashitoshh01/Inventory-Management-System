---
name: testing
description: Test pyramid, integration testing with real PostgreSQL, concurrency tests, and Playwright E2E suites.
---

# Purpose

Governs testing standards, quality gates, test environment isolation, and verification strategies across all workspaces.

# When To Use

- When creating or modifying tests (unit, integration, concurrency, or E2E).
- When validating bug fixes to prevent regressions.
- When evaluating whether a PR or milestone satisfies the Definition of Done.

# Responsibilities

- Maintain high test fidelity following the test pyramid: fast unit tests for domain logic, integration tests for database transactions, and targeted E2E tests for critical user journeys.
- Verify inventory correctness under high concurrency and race condition scenarios.
- Ensure that integration tests run against real PostgreSQL instances rather than in-memory mocks.

# Rules

1. **Real PostgreSQL for Integration Tests**: Database transaction tests, lock semantics, unique constraints, and foreign keys must run against a real PostgreSQL container. Mocks cannot validate relational invariants.
2. **Concurrency Verification**: Stock-changing mechanisms must have automated concurrency tests simulating simultaneous requests competing for identical inventory.
3. **E2E Critical Flows**: Playwright E2E tests must cover core workflows:
   - Login & session persistence
   - Product and SKU creation
   - Purchase order receiving
   - Stock adjustments & transfers
   - Order creation & fulfillment
   - Role-based UI restriction
4. **Regression Rule**: Every bug report must be accompanied by a failing test reproducing the issue before the fix is applied.
5. **Fast Feedback**: Unit tests must execute in seconds without external network dependencies.

# Required Checks

- [ ] Confirm integration tests tear down and isolate test data cleanly between suites.
- [ ] Verify that concurrency tests assert no negative stock balance occurs under simultaneous requests.
- [ ] Check that tests exercise both happy paths and failure/edge cases (e.g. insufficient stock, duplicate idempotency key, invalid role).
- [ ] Ensure all test scripts pass in the CI environment with zero flakiness.

# Common Mistakes

- Mocking the database layer so extensively that actual constraint violations and SQL bugs pass undetected.
- Relying exclusively on E2E tests for business edge cases, causing slow and brittle CI builds.
- Ignoring concurrency race conditions during stock mutations.
- Using shared test state that creates intermittent test order dependencies.

# Definition Of Done

- Unit tests cover domain algorithms, validation schemas, and state transitions.
- Integration tests verify PostgreSQL transactions, locking, and IDOR protections.
- E2E tests validate complete user journeys in Chromium/Firefox/WebKit.
- All test suites run and pass in local dockerized environments and GitHub Actions CI.
