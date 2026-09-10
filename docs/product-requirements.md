# Product Requirements

## Users

Suggested roles:

- Owner
- Admin
- Inventory Manager
- Purchasing Manager
- Sales Manager
- Warehouse Staff
- Sales/POS Staff
- Accountant/Viewer

Use permissions rather than hard-coding role names throughout the code.

Example permissions:

- `products.read`
- `products.write`
- `inventory.read`
- `inventory.adjust`
- `inventory.transfer`
- `purchasing.read`
- `purchasing.write`
- `purchasing.receive`
- `sales.read`
- `sales.create`
- `returns.create`
- `reports.read`
- `users.manage`
- `settings.manage`
- `audit.read`

## Core entities

- Organization
- User
- Role
- Permission
- Warehouse
- WarehouseLocation
- Product
- ProductVariant/SKU
- Category
- Brand
- UnitOfMeasure
- Supplier
- Customer
- PurchaseOrder
- PurchaseOrderLine
- GoodsReceipt
- Sale
- SaleLine
- Return
- ReturnLine
- StockBalance
- StockLedgerEntry
- StockTransfer
- StockTransferLine
- StockAdjustment
- Batch/Lot
- PriceList
- Notification
- AuditEvent
- Attachment
- ImportJob
- ExportJob
- IdempotencyRecord

## Product

Product should support:

- SKU;
- barcode(s);
- name;
- description;
- category;
- brand;
- unit of measure;
- cost price;
- selling price;
- reorder level;
- reorder quantity;
- active/inactive;
- image;
- tax configuration;
- batch/expiry tracking flag.

Do not assume one product always equals one physical stock unit. Use variants/SKUs when needed.

## Inventory

Inventory must support:

- multiple warehouses;
- warehouse locations;
- on-hand;
- reserved;
- available;
- in-transit;
- batch/lot;
- expiry;
- stock adjustments;
- transfers;
- stock count/reconciliation;
- immutable ledger.

Suggested derived equation:

`available = on_hand - reserved`

`in_transit` should be represented separately and should not reduce on-hand until the business workflow says it has left/arrived.

## Purchasing

Purchase order lifecycle:

```text
DRAFT
 → SUBMITTED
 → APPROVED
 → PARTIALLY_RECEIVED
 → RECEIVED
 → CLOSED
```

Cancelled/rejected states must be explicit.

Receiving stock must be transactional and auditable.

## Sales / POS

Sale lifecycle:

```text
DRAFT
 → CONFIRMED
 → PAID
 → COMPLETED
```

Support configurable payment states and partial payments only if the business requires them.

Stock must be reserved/deducted according to the chosen sales policy. Document the policy; never mix semantics.

## Returns

Returns need:

- original sale reference where available;
- returned quantity;
- condition;
- restock decision;
- reason;
- authorization;
- financial adjustment;
- stock ledger impact.

## Transfers

Transfer lifecycle:

```text
DRAFT
 → APPROVED
 → IN_TRANSIT
 → RECEIVED
```

A transfer must not accidentally create stock from nothing.

## Expiry

For tracked products:

- batch number;
- manufacture date when available;
- expiry date;
- quantity;
- warehouse;
- location.

Use scheduled jobs for:

- expiring soon;
- expired;
- low-stock notifications.

Notifications must be deduplicated.

## Dashboard

The supplied design suggests:

- total inventory value;
- total products;
- low-stock items;
- out-of-stock items;
- sales;
- sales overview;
- inventory value by category;
- recent activity;
- top-selling products;
- stock status;
- upcoming expiry.

Dashboard numbers must come from real queries/aggregates. Never calculate authoritative KPIs solely from visible table rows.

## Search

Global search can cover:

- SKU;
- barcode;
- product name;
- invoice number;
- purchase order;
- customer;
- supplier.

Use debouncing in the UI and indexed queries in PostgreSQL.

## Import/export

Imports:

- validate headers;
- validate every row;
- show a dry-run preview;
- produce row-level errors;
- do not partially mutate data unless explicitly supported;
- use an import job for large files.

Exports:

- permission-protected;
- asynchronous for large result sets;
- expiring download URL;
- audit the export.

## Non-functional requirements

- accessible keyboard navigation;
- responsive layout;
- reliable on Chromium/Firefox/Safari current versions;
- timezone-aware timestamps;
- configurable currency;
- configurable locale/date format;
- auditability;
- backup and restore procedures;
- graceful error handling.
