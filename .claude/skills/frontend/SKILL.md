---
name: frontend
description: Standards, design system integration, and state management for Next.js 16.x Active LTS web application.
---

# Purpose
Governs the implementation of the user interface in `apps/web`, ensuring modern UI/UX, accessibility, robust query caching, and strict exclusion of server-side business rules.

# When To Use
- When creating or modifying pages, layouts, components, or client hooks in `apps/web`.
- When integrating with the backend API via TanStack Query.
- When creating reusable design system primitives in `packages/ui`.

# Responsibilities
- Implement accessible, performant, responsive user interfaces following the reference design (dark navy sidebar, light canvas, blue/indigo accents).
- Manage asynchronous server state using TanStack Query / React Query, handling loading, empty, error, and optimistic states correctly.
- Provide client-side form validation using Zod schemas shared from `packages/types`.
- Enforce that UI components are pure presentation and transport triggers, not business authorities.

# Rules
1. **Next.js 16.x Active LTS & React 19.x**: Use stable, documented patterns. Do not use experimental flags unless explicitly required.
2. **Zero Business Invariants in UI**: Never compute final stock availability, prices, or permissions on the client. Authorization decisions must be enforced by the server.
3. **Handle All UI States**: Every data-driven component must explicitly render loading (skeleton), empty state, error state, and permission-denied state.
4. **Server-Side Data Tables**: Admin tables must support server-side pagination, sorting, search debouncing, and filtering. Never fetch thousands of records to paginate client-side.
5. **No Direct Database Access**: Never attempt to connect to PostgreSQL or import Prisma inside `apps/web`.
6. **Form Discipline**: Disable submit buttons during pending mutations to prevent accidental double-submits. Prompt confirmation dialogs for destructive actions.
7. **Accessibility (a11y)**: Must meet WCAG AA standards: semantic HTML, visible focus rings, keyboard navigability, proper ARIA attributes, and no reliance on color alone for status.

# Required Checks
- [ ] Confirm all data fetching is routed through the `/api/v1` client with credentials and correlation headers.
- [ ] Verify that forms implement Zod schema validation matching API expectations.
- [ ] Check responsive behavior on mobile/tablet viewports for warehouse floor usability.
- [ ] Verify keyboard accessibility and tab order on all interactive components.
- [ ] Confirm no business calculations or authorization bypasses exist in frontend state.

# Common Mistakes
- Relying on client-side state as the single source of truth for stock or user permissions.
- Hardcoding backend URLs or failing to propagate credentials and correlation headers.
- Letting UI buttons trigger mutations repeatedly without disabling or showing loading feedback.
- Omitting error boundary handling or leaving unhandled API error rejections.

# Definition Of Done
- UI renders cleanly and responsively according to design guidelines across desktop, tablet, and mobile.
- All four states (loading, empty, error, populated) are handled gracefully.
- Accessibility standards (visible focus, keyboard navigation, semantic HTML) are verified.
- Unit and component tests pass without warnings.
