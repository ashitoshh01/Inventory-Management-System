---
name: code-review
description: Pull request audit standards, architectural compliance checklist, and invariant verification.
---

# Purpose

Governs the review process for code modifications, ensuring every change preserves architectural invariants, security policies, and inventory correctness.

# When To Use

- When performing pre-commit checks, PR reviews, or self-evaluations of AI-generated code.
- When verifying that a task adheres strictly to the Definition of Done.

# Responsibilities

- Audit proposed diffs against repository engineering rules and architectural standards.
- Detect anti-patterns, boundary breaches, security oversights, and unhandled race conditions.
- Prevent regression of non-negotiable inventory invariants.

# Rules

1. **Zero Architectural Drift**: Reject any PR that places business logic in controllers, UI components, or introduces direct database queries in `apps/web`.
2. **Stock Verification Check**: Ensure any code touching stock balances strictly executes inside a PostgreSQL transaction, locks rows pessimistically, and appends to `StockLedgerEntry`.
3. **Authorization Check**: Ensure every new or modified endpoint enforces server-side permission checks and tenant scoping.
4. **Validation Check**: Ensure all external payloads are strictly parsed and validated using Zod or DTO validators.
5. **Types and Errors**: Reject any usage of TypeScript `any` or broad unhandled `catch (e) {}` blocks.
6. **Test Coverage**: Reject any feature or bugfix lacking automated unit, integration, or regression tests.

# Required Checks

- [ ] Is stock balance mutated without a ledger entry? (Auto-reject if true).
- [ ] Are permissions verified on the server? (Auto-reject if UI-only).
- [ ] Is there any chance of cross-tenant data access? (Auto-reject if IDOR exists).
- [ ] Are money or quantities stored in binary floating-point numbers? (Auto-reject if `Float`).
- [ ] Are all database queries bounded by pagination?
- [ ] Are all newly added environment variables documented in `.env.example`?

# Common Mistakes

- Approving PRs based solely on whether the code compiles, without verifying data invariants.
- Overlooking missing idempotency keys on retryable mutation endpoints.
- Allowing `SELECT *` queries in hot paths.
- Accepting UI mock data instead of real API integration.

# Definition Of Done

- All items in the review checklist pass without exception.
- Linter, typechecker, and test suites report zero errors and zero warnings.
- Documentation or ADRs are updated if system behavior changed.
