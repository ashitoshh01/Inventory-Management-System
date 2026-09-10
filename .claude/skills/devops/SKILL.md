---
name: devops
description: Monorepo tooling, pnpm workspaces, Turborepo pipeline caching, and Docker environment coordination.
---

# Purpose

Governs monorepo orchestration, task pipelines, workspace dependency management, local containerized infrastructure, and CI automation.

# When To Use

- When configuring or troubleshooting `pnpm-workspace.yaml`, `turbo.json`, or root package scripts.
- When maintaining `infra/docker-compose.yml` (PostgreSQL, Redis, MinIO).
- When configuring or modifying GitHub Actions CI pipelines.

# Responsibilities

- Maintain fast, reproducible development environments and CI pipelines.
- Ensure pnpm dependency resolution and Turborepo task caching are optimal and error-free.
- Provide clean local container orchestration for external dependencies.

# Rules

1. **pnpm Workspace Contract**: All intra-monorepo dependencies must use the `workspace:*` protocol.
2. **Turborepo Pipeline Accuracy**: Declare explicit `inputs`, `outputs`, and `dependsOn` in `turbo.json` so build and test caching are reliable and deterministic.
3. **Reproducible Local Stack**: `infra/docker-compose.yml` must spin up all backing services (PostgreSQL 16, Redis 7, MinIO) with sensible local defaults and healthchecks.
4. **Clean Dependency Management**: Root `package.json` contains only workspace-wide orchestration dependencies; applications and packages manage their own specific runtime dependencies.
5. **CI Quality Gates**: The CI pipeline must run:
   1. Clean install with lockfile (`pnpm install --frozen-lockfile`)
   2. Linting (`turbo run lint`)
   3. Type-checking (`turbo run typecheck`)
   4. Unit and integration tests (`turbo run test`)
   5. Builds (`turbo run build`)
   6. Vulnerability scanning (`pnpm audit`)

# Required Checks

- [ ] Confirm `pnpm install` succeeds without phantom dependencies or peer dependency errors.
- [ ] Verify `docker compose up -d` brings up PostgreSQL, Redis, and MinIO into healthy states.
- [ ] Ensure Turborepo cache misses only occur when source files actually change.
- [ ] Verify CI runs against pull requests before merging into `main`.

# Common Mistakes

- Committing modifications without updating the `pnpm-lock.yaml`.
- Installing backend dependencies (like `@nestjs/core`) in the root workspace.
- Forgetting volume persistence in local Docker Compose configurations.
- Using unpinned Docker image tags (`latest`) instead of specific version tags.

# Definition Of Done

- Monorepo commands (`pnpm build`, `pnpm test`, `pnpm lint`) execute cleanly across all packages via Turborepo.
- Local infrastructure starts with a single command (`docker compose up -d`).
- GitHub Actions CI workflow runs green on all pull requests.
