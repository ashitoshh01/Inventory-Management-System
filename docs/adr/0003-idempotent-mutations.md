# ADR 0003 — Idempotent Business Mutations

## Status

Accepted

## Decision

Mutation endpoints that may be retried support idempotency keys.

The server stores:

- actor;
- organization;
- endpoint/operation;
- idempotency key;
- request fingerprint;
- resulting status;
- resulting response reference;
- timestamps.

## Why

Real systems retry due to browser refreshes, network failures, load balancers, workers, and users double-clicking.

Idempotency prevents duplicate sales, receipts, transfers, and adjustments.
