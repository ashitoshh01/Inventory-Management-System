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
