# Production Readiness Checklist

## Foundation

- [ ] Monorepo builds
- [ ] lint/typecheck configured
- [ ] environment validation
- [ ] CI configured
- [ ] error tracking configured
- [ ] structured logging configured

## Identity & security

- [ ] authentication
- [ ] RBAC
- [ ] tenant isolation if multi-tenant
- [ ] session security
- [ ] rate limiting
- [ ] security headers
- [ ] secret management
- [ ] audit events

## Catalog

- [ ] products/SKUs
- [ ] barcodes
- [ ] categories
- [ ] brands
- [ ] units
- [ ] prices
- [ ] product lifecycle

## Warehouses

- [ ] warehouses
- [ ] locations
- [ ] warehouse permissions

## Inventory

- [ ] stock balances
- [ ] immutable ledger
- [ ] adjustments
- [x] transfers
- [ ] reservations
- [ ] stock counts
- [ ] batch/lot
- [ ] expiry
- [ ] low-stock thresholds
- [ ] concurrency tests
- [ ] reconciliation report

## Purchasing

- [ ] suppliers
- [x] purchase orders
- [x] approval
- [x] receiving
- [x] partial receiving
- [x] procurement metrics & operational dashboard
- [x] live inventory reconciliation (PO lines ↔ GoodsReceipt ↔ StockLedger ↔ StockBalance)
- [x] audit history timeline

## Sales

- [ ] customers
- [ ] sales/POS
- [ ] payment states
- [ ] cancellation policy
- [ ] returns

## Reporting

- [x] inventory valuation
- [x] stock movement
- [x] sales
- [x] low stock
- [ ] expiry
- [x] export jobs

## Bulk Operations & Imports

- [x] RFC 4180 CSV parser with formula injection protection and BOM stripping
- [x] Product catalog bulk import (CREATE / UPSERT modes)
- [x] Stock mutation bulk import (strict StockMutationService authority & idempotency)
- [x] Dry-run validation preview API (`POST /imports/preview`)
- [x] Asynchronous background import worker (`BullMQ` `import-queue`)
- [x] Persistent `ImportJob` state machine and progress tracking
- [x] Structured error CSV export (`GET /imports/:id/errors`)
- [x] Next.js Bulk Import UI with drag & drop, preview table, and live polling

## Reliability

- [ ] database backups
- [ ] restore drill
- [ ] health/readiness
- [ ] graceful shutdown
- [ ] queue retries
- [ ] idempotency
- [ ] deployment rollback
- [ ] monitoring alerts

## UX

- [ ] responsive
- [ ] keyboard accessible
- [ ] loading states
- [ ] empty states
- [ ] error states
- [ ] permission states
- [ ] confirmation dialogs
- [ ] table pagination/filtering

## Performance

- [ ] 100-user load test
- [ ] dashboard benchmark
- [ ] stock mutation benchmark
- [ ] DB query plans
- [ ] no obvious N+1
- [ ] bounded payloads

## Final

- [ ] staging smoke test
- [ ] production runbook
- [ ] security review
- [ ] migration review
- [ ] user acceptance testing
