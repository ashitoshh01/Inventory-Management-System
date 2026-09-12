# UI System

## Visual direction

The supplied references establish:

- light content canvas;
- deep navy sidebar;
- blue/indigo primary accent;
- rounded cards;
- restrained shadows;
- compact typography;
- data-dense tables;
- status badges;
- clear hierarchy.

The UI should feel like a professional business application, not a marketing landing page.

## Layout

Desktop:

- fixed/collapsible sidebar;
- top utility bar;
- page title + context;
- action area;
- content cards/tables.

Mobile:

- sidebar becomes drawer;
- tables become horizontally scrollable or card-based where appropriate;
- primary action remains easy to reach;
- filters collapse into a sheet/drawer.

## Design tokens

Centralize:

- colors;
- spacing;
- radius;
- shadows;
- typography;
- z-index;
- breakpoints.

Do not scatter arbitrary values throughout components.

## Components

Create reusable primitives:

- Button
- Input
- Select
- DateRangePicker
- Modal/Dialog
- Drawer
- Dropdown
- Tooltip
- Badge
- Card
- Table
- Pagination
- EmptyState
- ErrorState
- Skeleton
- Toast
- ConfirmDialog
- FormField
- SearchCommand

## Tables

Every important table should consider:

- server-side pagination;
- search;
- filters;
- sorting;
- column visibility;
- export;
- loading;
- empty state;
- error state;
- row actions;
- keyboard/accessibility support.

Do not load thousands of rows just to paginate them in the browser.

## Forms

Use:

- field-level validation;
- server error mapping;
- disabled submit during mutation;
- dirty-state handling;
- confirmation for destructive operations.

## Dashboard

Avoid rendering ten independent API requests on first paint.

Prefer a dashboard summary endpoint or server-side aggregation strategy.

## Accessibility

Minimum:

- semantic HTML;
- visible focus;
- keyboard navigation;
- labels for form controls;
- adequate contrast;
- aria attributes only when semantic HTML is insufficient;
- no color-only status meaning.

## Responsive behavior

Design from mobile upward, then enhance for desktop. The reference is desktop-heavy, but real users may use tablets or phones in warehouses.

## Product Management UX Conventions (Phase 3E)

### URL State Architecture

- URL search parameters mirror the active list state (`/products?search=...&categoryId=...&status=...&unitOfMeasure=...&sortBy=...&sortOrder=...&page=...&limit=...`).
- Browser refresh, back, and forward navigation automatically restore state.
- Updating search, filters, or sort criteria resets `page` to 1.
- Synchronized using shallow Next.js `router.replace` with `scroll: false` to avoid layout jumping or duplicate history stacks.

### Search & Debounce

- 300ms debounce prevents excessive API calls during typing.
- Dedicated clear button and Escape key immediately reset search.
- Empty states clearly differentiate between an empty organization catalog vs. no search/filter matches.

### Sorting UX & Accessibility

- Supported backend sort fields: `sku`, `name`, `unitOfMeasure`, `status`, `createdAt`.
- Sort headers are keyboard interactive (`tabIndex={0}`, Enter / Space triggers) and expose `aria-sort="ascending" | "descending" | "none"`.
- Directional arrow indicators reflect current sort state.

### Pagination & Auto-Recovery

- Displayed as `Showing X–Y of Z results` using standard en-dash.
- Direct page buttons provide quick jumping with `aria-current="page"`.
- If an item deletion shrinks total pages below the current active page, the page automatically recovers to the highest valid page (`Math.max(1, totalPages)`).

### Cache & Tenancy Strategy

- All TanStack Query keys are prefixed by active organization ID.
- `placeholderData: (prev) => prev` preserves previous page data during refetches to avoid blank skeleton flicker.

## Stock Management UI Conventions (Phase 5D)

### Real API-Driven Architecture

- The frontend maintains zero authoritative stock state, zero local balance arithmetic, and zero optimistic calculations.
- All balance queries read from authoritative backend endpoints (`/stock/balances`, `/stock/balances/:id`, `/stock/balances/product/:productId`, `/stock/balances/warehouse/:warehouseId`).
- All inventory mutations flow exclusively through `POST /stock/mutations`, backed by the authoritative transactional engine from Phase 5B and REST layer from Phase 5C.

### Exact Decimal Precision

- Stock quantities are strictly treated as strings with up to 4 decimal places (e.g. `"10.0000"`, `"0.0000"`).
- Client-side code never uses floating-point conversions (`parseFloat`, `Number(q) * 0.1`) that could introduce IEEE 754 precision loss.
- Zero-quantity stock balances display a distinctive "Zero Stock" badge and muted formatting.

### Two-Phase Stock Mutation Workflow

- **Form Input Step**: Operators select mutation type (`OPENING`, `RECEIPT`, `ISSUE`, `ADJUSTMENT`), target product, target warehouse, and exact decimal quantity. Sign is automatically inferred (RECEIPT/OPENING always positive, ISSUE always negative) or selected (ADJUSTMENT increase/decrease direction).
- **Confirmation Review Step**: Prior to execution, operators review a summary card displaying target product, target warehouse, operation type, computed signed delta, and generated idempotency key.
- **Idempotency Contract**: Generates a cryptographically secure UUID (`crypto.randomUUID()`) per mutation session. Propagated via both `Idempotency-Key` header and payload `idempotencyKey`.
- **Replay Feedback**: When the backend returns `isIdempotentReplay: true`, the UI displays a notification indicating the transaction was previously committed.
- **Double-Click & Conflict Protection**: Submit action is disabled while `isPending`. Domain conflicts (`INSUFFICIENT_STOCK`, `PRODUCT_NOT_FOUND`, `WAREHOUSE_NOT_FOUND`) map directly to contextual error alerts.

### Tenancy & Cache Scoping

- Query keys are strictly tenant-isolated via `stockKeys.all(currentOrgId)`.
- Stock mutation execution invalidates all tenant-scoped stock queries (`stockKeys.all(currentOrgId)`), ensuring balance tables across all views refresh automatically.

## Stock Ledger / History UI Conventions (Phase 5E)

### Immutable Historical Audit Record

- The ledger represents an immutable audit log of all stock mutations.
- The UI strictly enforces read-only access: absolute absence of edit, mutate, reverse, or delete controls across list and detail views.
- An explicit "Immutable Audit Record" banner on detail views informs operators that ledger entries cannot be altered or deleted.

### Arithmetic Consistency Verification

- Detail views present an exact mathematical breakdown card verifying: `Balance Before + Delta = Balance After`.
- All quantities and deltas preserve exact decimal string representations with up to 4 decimal places (e.g. `"+10.0000"`, `"-5.2500"`, `"0.0000"`), with zero client-side floating-point conversions.

### Real REST API Integration & Supported Filtering

- Direct integration with Phase 5C endpoints: `GET /stock/ledger` and `GET /stock/ledger/:id`.
- Supported server-side filters: `productId`, `warehouseId`, `type` (`OPENING`, `RECEIPT`, `ISSUE`, `ADJUSTMENT`).
- Supported server-side sort fields: `createdAt`, `quantityDelta`, `quantityBefore`, `quantityAfter`, `type`.
- Unsupported filter boundary: The backend does not support free-text search or arbitrary date range parameters; client-side simulation over full datasets is strictly rejected.

### URL State & Navigation Architecture

- URL search parameters mirror ledger state (`/stock/ledger?productId=...&warehouseId=...&type=...&sortBy=...&sortOrder=...&page=...&limit=...`).
- Seamless cross-linking between balances and ledger: "View Ledger History" buttons on `/stock` and `/stock/:id` pre-filter the ledger by product and warehouse.
