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
