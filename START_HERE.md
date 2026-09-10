# START HERE — Production Inventory Management System

This document is the primary onboarding guide and AI-agent context pack for the Inventory Management System.

---

## Authoritative Architecture Overview

- **Pattern**: Decoupled Modular Monolith
- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend (`apps/web`)**: Next.js 16.x Active LTS + React 19.x + Tailwind CSS
- **Backend (`apps/api`)**: NestJS + TypeScript
- **Database (`packages/database`)**: PostgreSQL 16+ (authoritative system of record) + Prisma ORM
- **Cache / Queues**: Redis + BullMQ
- **Object Storage**: S3-compatible (MinIO for local dev)

> [!IMPORTANT]
> The former Next.js monolith in git history (`HEAD~1`) is **strictly historical**. Do not use it as an implementation reference or pattern.

---

## Mandatory Reading Order for AI Coding Agents

Before planning or executing any task, read these documents in sequence:

1. [CLAUDE.md](file:///home/ashu/Desktop/Inventory-Management/CLAUDE.md) — Master instructions, invariants, and operational workflow.
2. [docs/ENGINEERING_RULES.md](file:///home/ashu/Desktop/Inventory-Management/docs/ENGINEERING_RULES.md) — Non-negotiable engineering rules and constraints.
3. [docs/IMPLEMENTATION_ORDER.md](file:///home/ashu/Desktop/Inventory-Management/docs/IMPLEMENTATION_ORDER.md) — Authoritative phase sequence and milestones.
4. [docs/DEFINITION_OF_DONE.md](file:///home/ashu/Desktop/Inventory-Management/docs/DEFINITION_OF_DONE.md) — Acceptance gates required for each phase.
5. [docs/architecture.md](file:///home/ashu/Desktop/Inventory-Management/docs/architecture.md) — System architecture, boundaries, and concurrency patterns.
6. [docs/database.md](file:///home/ashu/Desktop/Inventory-Management/docs/database.md) — PostgreSQL data model, ledger mechanics, and integrity rules.
7. [docs/security.md](file:///home/ashu/Desktop/Inventory-Management/docs/security.md) — RBAC, tenant isolation, IDOR prevention, and Argon2id.
8. [docs/api.md](file:///home/ashu/Desktop/Inventory-Management/docs/api.md) — REST API conventions, versioning, response envelopes, and idempotency.
9. [docs/ui.md](file:///home/ashu/Desktop/Inventory-Management/docs/ui.md) — UI direction, design tokens, and accessibility standards.
10. [docs/testing.md](file:///home/ashu/Desktop/Inventory-Management/docs/testing.md) — Test pyramid, integration with real PostgreSQL, and concurrency tests.
11. [docs/deployment.md](file:///home/ashu/Desktop/Inventory-Management/docs/deployment.md) — Deployment topology and migration execution order.
12. [docs/observability.md](file:///home/ashu/Desktop/Inventory-Management/docs/observability.md) — Structured JSON logging, tracing, and metrics.
13. Relevant Architecture Decision Records:
    - [docs/adr/0001-modular-monolith.md](file:///home/ashu/Desktop/Inventory-Management/docs/adr/0001-modular-monolith.md)
    - [docs/adr/0002-inventory-ledger.md](file:///home/ashu/Desktop/Inventory-Management/docs/adr/0002-inventory-ledger.md)
    - [docs/adr/0003-idempotent-mutations.md](file:///home/ashu/Desktop/Inventory-Management/docs/adr/0003-idempotent-mutations.md)
    - [docs/adr/0004-nextjs-version.md](file:///home/ashu/Desktop/Inventory-Management/docs/adr/0004-nextjs-version.md)
    - [docs/adr/0005-database-package.md](file:///home/ashu/Desktop/Inventory-Management/docs/adr/0005-database-package.md)
14. The relevant skill under `.claude/skills/<skill_name>/SKILL.md`.

---

## Specialized Skill Directory

Before executing a task in any specific discipline, inspect and apply its corresponding skill:

- Architecture: `.claude/skills/architecture/SKILL.md`
- Frontend: `.claude/skills/frontend/SKILL.md`
- Backend: `.claude/skills/backend/SKILL.md`
- Database: `.claude/skills/database/SKILL.md`
- Inventory Domain: `.claude/skills/inventory-domain/SKILL.md`
- API: `.claude/skills/api/SKILL.md`
- Security: `.claude/skills/security/SKILL.md`
- Testing: `.claude/skills/testing/SKILL.md`
- Deployment: `.claude/skills/deployment/SKILL.md`
- Code Review: `.claude/skills/code-review/SKILL.md`
- DevOps: `.claude/skills/devops/SKILL.md`
- Performance: `.claude/skills/performance/SKILL.md`
- Observability: `.claude/skills/observability/SKILL.md`

---

## How to Prompt and Execute Work

Before implementing any feature:

1. Use the template in [docs/agent-task-template.md](file:///home/ashu/Desktop/Inventory-Management/docs/agent-task-template.md).
2. Adhere strictly to the phase progression in [docs/IMPLEMENTATION_ORDER.md](file:///home/ashu/Desktop/Inventory-Management/docs/IMPLEMENTATION_ORDER.md).
3. Do not jump ahead to UI or reporting before the database and domain models are proven with automated integration tests.
