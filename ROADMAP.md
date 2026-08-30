# Phase-Wise Implementation Roadmap (Modules 2.1 → 2.9)

Build in this order — each phase produces something demoable, and later phases
depend on earlier ones (you can't do stock movements before products exist,
can't do purchasing before stock exists, etc).

---

## Phase 0 — Foundation (before any feature)
**Goal:** empty app that runs, connects to Postgres, has auth.

- [ ] Init Next.js + TypeScript project, install Prisma, Tailwind, shadcn/ui
- [ ] Run `docker compose up -d`, confirm Postgres connection
- [ ] Add the schema.prisma from this scaffold, run first migration
- [ ] Set up Auth.js with email/password login
- [ ] Implement `User` + `RoleName` — seed one ADMIN user
- [ ] Build basic dashboard shell (sidebar nav, empty pages for each module)
- [ ] Set up `lib/permissions.ts` with a `can(user, action, resource)` helper

**Done when:** you can log in as admin and see an empty dashboard shell.

---

## Phase 1 — Product / SKU Management (2.1)
**Goal:** full CRUD on products, ready to hold stock.

- [ ] Category CRUD (with parent/child nesting)
- [ ] Product CRUD form: SKU, barcode, name, unit, cost/sale price, category
- [ ] Product image upload (start local disk, swap to S3 later)
- [ ] Product variants (attributes as JSON: size/color)
- [ ] Bundle/kit builder (select component products + quantities)
- [ ] Batch/expiry toggle per product (`trackBatches` flag)
- [ ] Bulk import via CSV (use a library like `papaparse` on the client,
      validate rows with Zod before insert)
- [ ] Barcode generation (bwip-js) + printable label view

**Done when:** you can create a product, mark it as batch-tracked, and see it
in a searchable/filterable product list.

---

## Phase 2 — Warehouses & Stock Management (2.2)
**Goal:** stock has a real, auditable location and quantity.

- [ ] Warehouse CRUD
- [ ] `stock.service.ts`: central function `recordMovement()` that all other
      modules call — never touch `StockLevel` directly elsewhere
- [ ] Stock level view per warehouse (searchable table: product, qty, bin)
- [ ] Manual stock adjustment form (with required reason code)
- [ ] Stock transfer between warehouses (creates two linked movements)
- [ ] Bin/shelf location field on `StockLevel`
- [ ] Reorder point / low-stock flag shown in product list
- [ ] Batch/lot detail view (expiry dates, quantities per batch)
- [ ] Cycle count / stock audit tool (compare system qty vs counted qty,
      auto-generate adjustment movements for discrepancies)

**Done when:** you can move stock between warehouses and see the movement
history for any product.

---

## Phase 3 — Purchasing (2.3)
**Goal:** bring stock in through a real procurement workflow.

- [ ] Supplier CRUD
- [ ] Purchase Order creation (multi-line item form)
- [ ] PO approval workflow (DRAFT → PENDING_APPROVAL → APPROVED)
- [ ] Goods receipt screen: mark items received (full or partial), triggers
      `recordMovement(PURCHASE_RECEIPT)` and updates `StockLevel`
- [ ] Purchase return / debit note flow
- [ ] Auto-suggest PO based on products below `reorderPoint` (simple query first,
      no ML needed yet — that's Phase 8)

**Done when:** creating and receiving a PO correctly increases stock and is
visible in the movement history.

---

## Phase 4 — Sales & Order Management (2.4)
**Goal:** stock goes out through a real sales workflow.

- [ ] Customer CRUD
- [ ] Sales Order creation (quotation → confirmed → shipped → invoiced)
- [ ] Stock reservation on order confirmation (`reservedQty` on `StockLevel`)
- [ ] Backorder handling when requested qty > available qty
- [ ] Sales return / credit note flow
- [ ] Simple invoice PDF generation (use a library like `@react-pdf/renderer`)

**Done when:** confirming a sales order reserves stock, and shipping it
deducts stock via a `StockMovement`.

---

## Phase 5 — POS (2.5)
**Goal:** fast in-store checkout on top of the same sales engine.

- [ ] POS screen: barcode scan (or manual search) → add to cart → checkout
- [ ] Creates a `SalesOrder` with `channel = "POS"` under the hood — reuse
      Phase 4 logic, don't build a parallel stock-deduction path
- [ ] Receipt view (print-friendly)
- [ ] Basic discount support on line items
- [ ] Offline queueing (optional, can be deferred — cache cart in local state,
      sync when connection returns)

**Done when:** a POS sale correctly deducts stock the same way a regular
sales order does.

---

## Phase 6 — Reporting & Analytics (2.6)
**Goal:** turn the transaction data from Phases 1-5 into insight.

- [ ] Dashboard cards: total stock value, low-stock count, today's sales
- [ ] Sales trend chart (Recharts) — daily/weekly/monthly
- [ ] Profit margin report (salePrice - costPrice per line item, aggregated)
- [ ] Dead stock report (products with no `StockMovement` of type SALE in N days)
- [ ] ABC analysis (rank products by revenue contribution)
- [ ] Export any report table to PDF/Excel

**Done when:** the dashboard reflects real data from your test purchases/sales.

---

## Phase 7 — Roles & Permissions Hardening (2.8)
**Goal:** lock down what was left open for speed in earlier phases.

- [ ] Enforce `permissions.ts` checks on every service function, not just UI
- [ ] Location-based restriction: WAREHOUSE_STAFF only sees their `warehouseId`
- [ ] Audit log: hook `AuditLog` writes into every service mutation
- [ ] 2FA on login (TOTP)

**Done when:** logging in as WAREHOUSE_STAFF only shows that warehouse's data,
and every mutation appears in the audit log.

---

## Phase 8 — Forecasting (2.7)
**Goal:** basic predictive reorder suggestions (start simple, no ML needed).

- [ ] Moving average of last N periods' sales per product
- [ ] Suggested reorder qty = (avg daily sales × lead time) + safety stock
- [ ] Seasonal flag (optional): compare same month last year if data exists
- [ ] Surface suggestions on the Purchasing screen from Phase 3

**Done when:** the "create PO" screen can pre-fill suggested quantities.

---

## Phase 9 — Notifications & Alerts (2.9)
**Goal:** proactive alerts instead of users having to check manually.

- [ ] `notification.service.ts` — create in-app `Notification` rows
- [ ] BullMQ scheduled job: low-stock scan (every 15 min) → notify managers
- [ ] BullMQ scheduled job: expiry warning scan (daily) → notify warehouse staff
- [ ] PO approval pending notification (real-time, on creation)
- [ ] Email notifications via Resend for critical alerts
- [ ] In-app notification bell + dropdown, mark-as-read

**Done when:** letting stock fall below `reorderPoint` in test data produces
both an in-app and email notification without manual checking.

---

## Suggested Pace
If working solo with AI-assisted coding: Phases 0-2 (~1 week), Phases 3-5
(~1.5 weeks), Phases 6-9 (~1 week) — roughly 3-4 weeks to a fully working
system covering everything through 2.9, assuming focused daily work.
