---
name: deployment
description: Production topology, release ordering, zero-downtime migrations, and health checks.
---

# Purpose
Governs deployment procedures, container packaging, production release ordering, and rollback safety for the modular monolith.

# When To Use
- When configuring Dockerfiles, container orchestrations, or production build scripts.
- When planning database migrations for staging or production.
- When introducing health, liveness, and readiness endpoints.

# Responsibilities
- Ensure reproducible, multi-stage Docker container builds for `apps/web` and `apps/api`.
- Maintain operational readiness, graceful shutdowns, and health check endpoints.
- Safeguard database migration execution during deployment lifecycles.

# Rules
1. **Deployment Ordering**: For schema changes, follow the safe migration sequence:
   ```text
   Backup/Verify → Apply Backward-Compatible Migration → Deploy API → Deploy Web → Smoke Test
   ```
2. **Health Endpoints**:
   - `/health/liveness`: Checks if the process is alive.
   - `/health/readiness`: Checks if required dependencies (PostgreSQL, Redis) are reachable.
   - Never expose internal infrastructure details, stack traces, or credentials in health endpoints.
3. **Graceful Shutdown**: The API must intercept `SIGTERM`/`SIGINT`, stop accepting new connections, and allow active transactions/jobs to finish within a bounded timeout.
4. **Expand/Contract for Breaking Changes**: Never drop a column or rename a table in a single deployment. Expand first (add new nullable column), deploy app, backfill data, and contract in a subsequent release.
5. **No Production Direct Deploys**: All production deployments must originate from tagged, verified CI builds on the main branch.

# Required Checks
- [ ] Ensure multi-stage Dockerfiles use minimal base images and non-root users.
- [ ] Verify that readiness checks test actual database and cache connectivity.
- [ ] Confirm graceful shutdown handlers close HTTP listeners and database connection pools cleanly.
- [ ] Check that migrations can be applied without table-locking downtime.

# Common Mistakes
- Running destructive database migrations simultaneously with API container restarts.
- Deploying frontend changes that require backend endpoints before those endpoints are live.
- Failing to configure connection pool limits, leading to database exhaustion under traffic.
- Omitting non-root user execution in production Docker containers.

# Definition Of Done
- Docker images build successfully with multi-stage caching and zero vulnerabilities.
- Liveness and readiness endpoints return valid 200 OK statuses when healthy.
- Graceful shutdown handles in-flight transactions without data corruption.
- Migration execution runbook is documented and verified in staging.
