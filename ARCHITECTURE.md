# Architecture

## Folder Structure

```
ims/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── products/
│   │   │   ├── warehouses/
│   │   │   ├── stock/
│   │   │   ├── purchasing/
│   │   │   ├── sales/
│   │   │   ├── pos/
│   │   │   ├── reports/
│   │   │   ├── users/
│   │   │   └── settings/
│   │   └── api/
│   │       ├── products/
│   │       ├── stock/
│   │       ├── purchase-orders/
│   │       ├── sales-orders/
│   │       ├── suppliers/
│   │       ├── customers/
│   │       ├── notifications/
│   │       └── reports/
│   ├── components/
│   │   ├── ui/              # shadcn components
│   │   └── shared/          # app-specific reusable components
│   ├── lib/
│   │   ├── db.ts            # Prisma client singleton
│   │   ├── auth.ts          # Auth.js config
│   │   ├── permissions.ts   # RBAC helper functions
│   │   └── validators/      # Zod schemas (one file per entity)
│   ├── services/            # business logic layer (NOT in API routes directly)
│   │   ├── product.service.ts
│   │   ├── stock.service.ts
│   │   ├── purchase.service.ts
│   │   ├── sales.service.ts
│   │   └── notification.service.ts
│   ├── jobs/                 # BullMQ background jobs
│   │   ├── low-stock-check.job.ts
│   │   └── expiry-check.job.ts
│   └── types/
└── docker-compose.yml
```

## Key Architectural Decisions

1. **Services layer between API routes and Prisma.** API routes stay thin (parse
   request → call service → return response). All business logic (stock deduction,
   reorder checks, validation rules) lives in `services/`. This keeps logic testable
   and reusable between the web API, POS, and background jobs.

2. **Every stock change goes through `stock.service.ts`.** Never update
   `StockLevel.quantity` directly from a route or component — always write a
   `StockMovement` row and let the service recompute the level. This gives you a
   full audit trail for free and prevents stock drift bugs.

3. **Zod schemas are shared** between client-side form validation and server-side
   API validation — define once in `lib/validators/`, import both places.

4. **RBAC checks happen in `lib/permissions.ts`**, called at the top of every
   service function, not just hidden in the UI. UI-only restriction is not security.

5. **Background jobs (BullMQ)** handle anything that shouldn't block a request:
   low-stock alert scanning, expiry warnings, scheduled report generation.
   Runs on a cron schedule (e.g. every 15 min) rather than checking on every request.

## Data Flow Example: Receiving a Purchase Order

```
UI (PO detail page) → POST /api/purchase-orders/[id]/receive
  → purchase.service.ts: receivePurchaseOrder()
      → validates PO status + quantities
      → stock.service.ts: recordMovement(PURCHASE_RECEIPT, ...)
          → creates StockMovement row
          → upserts StockLevel (increments quantity)
      → updates PurchaseOrderItem.receivedQty
      → updates PurchaseOrder.status
      → notification.service.ts: notify approver if fully received
  → returns updated PO to UI
```
