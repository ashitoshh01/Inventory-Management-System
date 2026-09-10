# ADR 0002 — Immutable Inventory Ledger + Current Balance

## Status

Accepted

## Decision

Maintain:

1. an immutable `StockLedgerEntry` history;
2. a current `StockBalance` for fast reads.

The balance is updated transactionally with the ledger.

## Why

Ledger-only reads become expensive at scale. Balance-only storage destroys traceability.

The combination provides:

- fast current inventory;
- complete movement history;
- reconciliation capability;
- auditability.

## Correction policy

Never rewrite historical stock movements. Correct mistakes with new ledger entries referencing the original transaction.
