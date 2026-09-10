# Shared Database Package

Prisma schema, SQL migrations, seed scripts, and generated database client utilities live here.

## Rules

- Authoritative persistence configuration only.
- Exclusively consumed by `apps/api` and operational tooling (seed/migrate).
- **CRITICAL INVARIANT**: `apps/web` must NEVER import from or depend on `packages/database`.
- All database mutations must be executed within transactional boundaries in `apps/api`.

See `docs/database.md`, `docs/adr/0005-database-package.md`, and `.claude/skills/database/SKILL.md`.
