# Shared Database Package (`@repo/database`)

The authoritative database foundation and persistence package for the Modular Monolith Inventory Management System.

---

## 1. Architectural Role & Invariants

- **Authoritative Persistence Only**: Owns the Prisma schema, versioned migrations, seed routines, and database client lifecycle.
- **Consumer Rules**:
  - `apps/api`: The **only** application workspace authorized to import from `@repo/database`.
  - `apps/web`: **Strictly forbidden** from importing from or depending on `@repo/database` (enforced via ESLint rule in `packages/config/eslint.web.mjs`). All frontend data access must flow through HTTP/JSON endpoints in `apps/api`.
- **Framework-Light**: Contains no NestJS controllers, HTTP handlers, or business repositories.

---

## 2. PostgreSQL & Connection Setup

### Canonical Environment Variable

`DATABASE_URL` is the canonical PostgreSQL connection string:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5436/inventory_dev?schema=public"
```

> **Note on Ports**: The local development infrastructure created in Phase 1B binds PostgreSQL to host port `5436` to prevent collisions with host PostgreSQL services. Always use the port configured in root `.env`.

---

## 3. Package Structure

```text
packages/database/
├── prisma/
│   ├── migrations/             # Version-controlled SQL migrations
│   │   └── 20260911173129_init/
│   │       └── migration.sql
│   ├── schema.prisma           # Prisma schema foundation
│   └── seed.ts                 # Idempotent connectivity seed script
├── src/
│   ├── index.ts                # Package exports (PrismaClient, types, PrismaService, PrismaModule)
│   ├── prisma.module.ts        # @Global() NestJS module exporting PrismaService
│   └── prisma.service.ts       # Singleton PrismaClient with NestJS lifecycle hooks
├── package.json
└── tsconfig.json
```

---

## 4. Operational Scripts

Execute these scripts from the repository root using `pnpm --filter @repo/database <command>`:

| Script                  | Command                 | Purpose                                                                                 |
| ----------------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| `prisma:generate`       | `prisma generate`       | Generates the Prisma Client types and query engine.                                     |
| `prisma:migrate`        | `prisma migrate dev`    | **Development only**: Applies pending migrations or generates new migration files.      |
| `prisma:migrate:deploy` | `prisma migrate deploy` | **Production/CI**: Applies committed migrations without schema introspection or prompt. |
| `prisma:status`         | `prisma migrate status` | Verifies database migration synchronization state.                                      |
| `prisma:seed`           | `tsx prisma/seed.ts`    | Runs the deterministic seed script (verifies database connectivity).                    |
| `prisma:studio`         | `prisma studio`         | Opens the Prisma visual database browser GUI.                                           |
| `prisma:reset`          | `prisma migrate reset`  | **DEVELOPMENT ONLY**: Drops database, recreates, applies all migrations, and runs seed. |

---

## 5. Prisma Lifecycle & NestJS Integration

`PrismaService` extends `PrismaClient` and implements NestJS `OnModuleInit` and `OnModuleDestroy`:

1. **Startup (`onModuleInit`)**: Eagerly connects via `await this.$connect()`.
2. **Shutdown (`onModuleDestroy`)**: Cleanly tears down database connections via `await this.$disconnect()`.
3. **Singleton Pattern**: Instantiated once per application process via `@Global() PrismaModule`. Eliminates per-request connection overhead and prevents connection leaks.
4. **Credential Safety**: Never logs raw `DATABASE_URL` strings or passwords in logs or exception messages.

---

## 6. Transactions & Concurrency

All business operations requiring atomicity must use Prisma transaction APIs:

```typescript
await prisma.$transaction(async (tx) => {
  // transactional logic executed atomically
});
```

---

## 7. Migration Safety Rules

1. **Zero Destructive Migrations in Production**: Never drop production tables or columns without a multi-phase deprecation deployment.
2. **Commit Migration Files**: All migrations in `prisma/migrations/` must be reviewed and committed to git.
3. **Deployment Separation**: Migrations must never run automatically during application boot. Run `prisma migrate deploy` as a dedicated step in deployment pipelines.
4. **No Premature Domain Models**: Phase 1D contains 0 business models. Business entities (Organizations, Users, Products, Inventory) will be introduced in their respective domain phases.

---

## 8. Backup & Disaster Recovery

- **Production**: Automated daily backups with point-in-time recovery (PITR).
- **Verification**: Regular restore drills to validate backup integrity.
