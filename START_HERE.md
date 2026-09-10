# START HERE — Production Inventory Management System

This folder is the AI-agent context pack for the Inventory Management System.

## Recommended reading order

1. `CLAUDE.md` — master instructions for the coding agent.
2. `README.md` — project overview and target stack.
3. `docs/product-requirements.md` — business scope and domain behavior.
4. `docs/architecture.md` — system architecture and boundaries.
5. `docs/database.md` — inventory data model and correctness rules.
6. `docs/security.md` — production security requirements.
7. `docs/api.md` — API conventions.
8. `docs/ui.md` — UI/design system direction.
9. `docs/testing.md` — test strategy.
10. `docs/deployment.md` — production deployment/operations.
11. `.claude/skills/*/SKILL.md` — load the relevant skill before each task.
12. `docs/PROJECT_CHECKLIST.md` — final production-readiness checklist.

## How to use with an AI coding agent

Keep the entire folder at the repository root. The agent should treat `CLAUDE.md` as the highest-level project instruction and use the relevant skill for each task.

Before asking the agent to implement a feature, use:
`docs/agent-task-template.md`

## Important

The documentation is intentionally opinionated around inventory correctness:
PostgreSQL is authoritative, stock mutations are transactional, stock history is immutable, permissions are server-side, and retryable mutations are idempotent.

The supplied screenshots are UI references, not a source of production data or business rules.
