# ADR 0010 — Purchase Order / Procurement Foundation

## Status

Accepted

## Context

Procurement management represents the commercial commitment pipeline in an inventory management system. Purchase Orders specify goods requested from suppliers, agreed pricing, expected delivery warehouses, and order statuses.

In Phase 6A, we establish the database and domain foundation for the Purchase Order aggregate. The architectural challenge is defining a procurement aggregate that preserves multi-tenant safety, provides exact monetary and quantity precision, maintains strict transactional atomicity, and cleanly decouples commercial order commitment from physical inventory ledger mutations.

## Decision

We establish the `PurchaseOrder` aggregate and procurement domain foundation with the following core architectural rules:

### 1. Purchase Order Aggregate Boundaries

```text
Organization (Tenant Boundary)
      │
      ├── Warehouse (Target Facility, onDelete: Restrict)
      │
      ├── PurchaseOrder (Aggregate Root, unique per tenant on purchaseOrderNumber)
      │         │
      │         └── PurchaseOrderLine[] (Child Entities, onDelete: Cascade)
      │                   │
      │                   └── Product (Authoritative Catalog, onDelete: Restrict)
```

- **`PurchaseOrder` (Aggregate Root)**: Owns order metadata, status lifecycle, supplier information, warehouse reference, order currency, and authoritative financial totals (`subtotal`, `taxTotal`, `grandTotal`).
- **`PurchaseOrderLine` (Child Entity)**: Represents line items specifying product reference, ordered quantity, unit price, authoritative line total, and received quantity tracking.
- **Tenant-Safe Composite Foreign Keys**:
  - `PurchaseOrder` references `Warehouse` via `[organizationId, warehouseId] -> Warehouse[organizationId, id]` (`onDelete: Restrict`).
  - `PurchaseOrderLine` references `PurchaseOrder` via `[organizationId, purchaseOrderId] -> PurchaseOrder[organizationId, id]` (`onDelete: Cascade`).
  - `PurchaseOrderLine` references `Product` via `[organizationId, productId] -> Product[organizationId, id]` (`onDelete: Restrict`).

Cross-tenant references are rejected directly by the PostgreSQL database engine.

### 2. Strict Stock Boundary Isolation

A Purchase Order represents **intent to purchase**, not physical stock receipt.

- Creating a Purchase Order strictly does **NOT** modify `StockBalance` and does **NOT** write `StockLedgerEntry` records.
- Transitioning a Purchase Order (`DRAFT → SUBMITTED → APPROVED`) strictly does **NOT** modify stock.
- Physical receipt of stock will be implemented in subsequent receiving phases, where goods receipt workflows will invoke `StockMutationService.executeMutation({ type: 'RECEIPT', ... })`.

### 3. Exact Fixed-Point Money & Quantity Representation

- All monetary values (`unitPrice`, `lineTotal`, `subtotal`, `taxTotal`, `grandTotal`) and quantities are stored as PostgreSQL `DECIMAL(14, 4)` via Prisma `@db.Decimal(14, 4)`.
- Binary floating-point JavaScript arithmetic is prohibited for authoritative calculations. Calculations are performed server-side using arbitrary-precision arithmetic (`Prisma.Decimal`).
- Authoritative calculation rules:
  - `lineTotal = quantity * unitPrice` (exact 4-decimal fixed string)
  - `subtotal = sum(lineTotal)`
  - `grandTotal = subtotal + taxTotal`
- Client-provided totals are discarded in favor of authoritative server calculations.
- PostgreSQL database check constraints enforce:
  - `quantity > 0`
  - `unitPrice >= 0`
  - `lineTotal >= 0`
  - `subtotal >= 0`
  - `grandTotal >= 0`
  - `grandTotal = subtotal + taxTotal`
  - `receivedQuantity >= 0` and `receivedQuantity <= quantity`

### 4. Deterministic Lifecycle State Machine

Order statuses follow a finite, deterministic state machine:

```text
DRAFT
  ├──→ SUBMITTED ──→ APPROVED ──→ PARTIALLY_RECEIVED ──→ RECEIVED ──→ CLOSED
  │        │            │                 │
  ▼        ▼            ▼                 ▼
CANCELLED (Terminal)  CANCELLED         CLOSED (Early close)
```

- Governed centrally by `PurchaseOrderStateMachine` via `StateMachineUtil`.
- Illegal transitions (e.g. `RECEIVED → DRAFT` or `DRAFT → APPROVED`) are rejected with `PurchaseOrderInvalidTransitionException`.
- `CLOSED` and `CANCELLED` are terminal states with zero outbound transitions.
- Self-transitions (e.g. `DRAFT → DRAFT`) are idempotent no-ops.

### 5. Product Linking vs Historical Snapshots

- `PurchaseOrderLine` references `Product` via composite foreign key with `onDelete: Restrict`.
- Because `onDelete: Restrict` is enforced by PostgreSQL, products referenced by historical procurement records cannot be deleted.
- If future business requirements demand frozen historical product snapshots (e.g. historical name/SKU changes), they can be introduced via an explicit snapshot migration without breaking relational integrity.

### 6. Minimal Supplier Representation

- Because a dedicated CRM/Vendor module does not yet exist in the schema, minimal supplier fields (`supplierName: String`, `supplierEmail: String?`) are embedded on `PurchaseOrder`.
- No speculative vendor tables or CRM abstractions are introduced ahead of their scheduled phase.

### 7. Atomic Transaction Boundaries

- Creation of a `PurchaseOrder` along with all child `PurchaseOrderLine` records is executed inside an interactive PostgreSQL transaction (`prisma.$transaction`).
- Any failure (validation error, foreign key violation, constraint failure) rolls back the entire aggregate atomically, ensuring zero orphan purchase orders or partial line sets.

## Consequences

### Positive

- Database-level tenant isolation prevents IDOR vulnerabilities across tenants.
- Server-authoritative fixed-point calculations prevent IEEE 754 precision drift.
- Strong referential integrity prevents accidental deletion of products and warehouses involved in procurement records.
- Zero stock mutation side effects preserve the core ledger invariants established in Phase 5.
- Centralized state machine prevents invalid state transitions.

### Negative / Trade-offs

- Direct database foreign key constraints require strict creation sequencing (organization, warehouse, and products must exist in tenant before order creation).
- Restrictive deletion semantics mean referenced warehouses and products cannot be purged without removing procurement history.
