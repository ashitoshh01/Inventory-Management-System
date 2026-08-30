# Advanced Inventory Management System (IMS)

Web-based inventory management system covering product management, multi-warehouse
stock control, purchasing, sales, POS, reporting, forecasting, roles/permissions,
and alerts/notifications.

## Tech Stack
- Next.js 14 (App Router) + TypeScript
- PostgreSQL + Prisma ORM
- Auth.js (NextAuth) — role-based access
- TailwindCSS + shadcn/ui
- TanStack Query + Zustand
- Zod (validation)
- Redis + BullMQ (background jobs — reorder alerts, scheduled reports)
- Resend / Nodemailer (email notifications)

## Getting Started

1. Copy `.env.example` to `.env` and fill in values
2. Start Postgres + Redis: `docker compose up -d`
3. Install deps: `npm install`
4. Run migrations: `npx prisma migrate dev`
5. Seed initial data (roles, admin user): `npx prisma db seed`
6. Start dev server: `npm run dev`

## Project Docs
- `ARCHITECTURE.md` — folder structure & module boundaries
- `ROADMAP.md` — phase-wise build plan (2.1 → 2.9)
- `CLAUDE.md` — conventions for AI-assisted ("vibe coding") development
