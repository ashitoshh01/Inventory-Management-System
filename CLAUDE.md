# AI Coding Conventions for This Repo

This file exists so any AI coding assistant (Claude Code, Cursor, Copilot, etc.)
generates consistent code instead of reinventing patterns every session. Point
your tool at this file / keep it in context.

## Non-negotiable rules

1. **Never write directly to `StockLevel` from an API route or component.**
   Always go through `services/stock.service.ts` → `recordMovement()`. This is
   the single source of truth for stock changes and audit trail.

2. **All business logic lives in `src/services/`, not in API routes or React
   components.** Routes should be ~10-20 lines: parse input, call service,
   return response.

3. **Every mutation-capable service function must call the permission check**
   from `lib/permissions.ts` first, using the current session's role — even if
   the UI already hides the button. Don't rely on UI-only restriction.

4. **Validate all external input with Zod** using schemas from
   `lib/validators/`. Reuse the same schema on the client form and the API
   route handler — don't write two versions.

5. **Every schema change goes through a Prisma migration**, never manual SQL
   against the dev database. Run `npx prisma migrate dev --name <description>`.

6. **Money fields use `Decimal`, never `Float`/`number` in the database or in
   calculations that touch the database.** Convert to `number` only at the
   final display layer.

7. **Follow the phase order in `ROADMAP.md`.** Don't build Phase 5 (POS)
   features before Phase 2-4 (stock/purchasing/sales) exist — POS reuses the
   sales engine, it doesn't duplicate it.

## When asked to add a feature

Before writing code, check:
- Does a service function already exist for this? Extend it, don't duplicate.
- Does this touch stock? → must go through `stock.service.ts`.
- Does this need a new DB field? → update `schema.prisma`, migrate, then code.
- Does this need permission restriction? → add the check.

## Naming conventions
- DB models: PascalCase singular (`Product`, not `Products`)
- API routes: kebab-case, REST-ish (`/api/purchase-orders/[id]/receive`)
- Service files: `<entity>.service.ts`
- Zod schemas: `<entity>.schema.ts`, exported as `create<Entity>Schema`,
  `update<Entity>Schema`
