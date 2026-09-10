# Web App

Next.js 16.x Active LTS application with React 19.x and Tailwind CSS.

Keep route/page composition and UI presentation here. Business rules, stock calculation, and authorization authority belong exclusively in the API/domain layer (`apps/api`).

`apps/web` must never import from `packages/database` or connect directly to PostgreSQL.

See root `CLAUDE.md`, `docs/ui.md`, and `.claude/skills/frontend/SKILL.md`.
