---
name: inventory-domain
description: Core domain rules, stock invariant equations, ledger mechanics, and life-cycle workflows.
---

# Purpose
Governs the core domain logic of inventory management: stock movements, warehouse balances, reservations, cycle counts, purchase receiving, order fulfillment, and auditability.

# When To Use
- When implementing or modifying features involving stock levels, inventory transfers, adjustments, purchase orders, sales orders, or returns.
- When writing services that calculate stock availability or enforce stock invariants.

# Responsibilities
- Treat stock as money-like critical data that cannot be created or destroyed without auditable justification.
- Enforce the foundational stock equation: `available = on_hand - reserved`.
- Coordinate the lifecycle transitions of Purchase Orders, Sales Orders, and Stock Transfers.
- Prevent stock loss, negative unreserved balances, and race conditions during concurrent orders.

# Rules
1. **Stock Mutation Workflow**:
   1. Validate actor authorization and tenant context.
   2. Validate product, SKU, warehouse, and location references.
   3. Open PostgreSQL transaction.
   4. Acquire pessimistic lock on affected `StockBalance` row (`FOR UPDATE`).
   5. Validate availability invariants (e.g. `on_hand - reserved >= delta`).
   6. Write immutable `StockLedgerEntry`.
   7. Update `StockBalance` atomically.
   8. Write domain event or audit log record.
   9. Commit transaction.
2. **Never Overwrite Stock**: Absolute quantity overwrites are prohibited. All stock modifications must specify an explicit delta and reason code.
3. **In-Transit Separation**: Transferred stock must move from source balance into an `IN_TRANSIT` state before being received at the destination; it must never instantly appear or vanish.
4. **Idempotency Requirement**: Every mutation endpoint (receiving, adjustments, fulfillment, returns) must check and store the idempotency key with the operation result.
5. **Batch and Expiry Tracking**: Products flagged with `trackBatches: true` must require batch numbers and valid expiry dates during receiving and movement.

# Required Checks
- [ ] Confirm that `available` is never allowed to drop below zero unless explicitly modeled for backorders.
- [ ] Ensure that every stock change creates a `StockLedgerEntry` row with non-zero delta.
- [ ] Check that transfer mutations lock both source and destination balances in sorted order to avoid deadlock.
- [ ] Verify that purchase order receiving updates received quantities and prevents over-receiving beyond allowed tolerance.
- [ ] Ensure cycle counts create reconciling adjustment entries rather than mutating history.

# Common Mistakes
- Relying on Redis to hold authoritative stock balances.
- Mutating stock on the client side or trusting client-calculated balances.
- Performing read-then-write updates without row-level database locks.
- Deleting or editing historical ledger entries to correct count errors.

# Definition Of Done
- Stock operations execute in atomic transactions with row locks.
- Every mutation leaves an immutable trace in `StockLedgerEntry`.
- Concurrency tests demonstrate that concurrent allocations never result in negative stock.
- Comprehensive unit and integration tests cover all lifecycle states.
