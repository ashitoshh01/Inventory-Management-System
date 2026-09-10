# Deployment & Operations

## Production topology

```text
Internet
   │
   ▼
CDN / Load Balancer
   ├── Next.js web
   └── NestJS API × 2
              │
              ├── PostgreSQL
              ├── Redis
              └── S3-compatible storage
```

This is enough for the initial ~100-user target.

## Environments

Maintain:

- local
- development
- staging
- production

Never point local development at production.

## Environment variables

Example categories:

```text
DATABASE_URL
REDIS_URL
SESSION_SECRET
JWT_SECRET                    # only if token architecture is selected
S3_ENDPOINT
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_REGION
APP_URL
API_URL
LOG_LEVEL
SENTRY_DSN                    # if selected
```

Do not commit actual values.

## CI pipeline

Every pull request:

1. install with lockfile;
2. lint;
3. typecheck;
4. unit tests;
5. integration tests;
6. build web/API;
7. dependency/security checks.

Protected main branch:

- required CI;
- reviewed pull request;
- no direct production deploy from a developer laptop.

## Deployment order

For compatible schema changes:

```text
backup/verify
 → migrate
 → deploy API
 → deploy web
 → smoke test
```

For breaking schema changes, use expand/contract migrations.

## Health endpoints

API should expose:

- liveness: process is running;
- readiness: dependencies required for serving traffic are available.

Do not expose secrets or detailed infrastructure information.

## Graceful shutdown

API must stop accepting new requests and allow in-flight requests/jobs to finish within a timeout.

## Database

Production PostgreSQL should have:

- automated backups;
- point-in-time recovery if available;
- monitoring;
- connection limits;
- TLS;
- restricted network access.

## Redis

Use Redis for:

- queues;
- cache;
- rate limiting;
- short-lived locks only when justified.

Never use Redis as the only storage for inventory.

## Background workers

Run worker processes separately from the HTTP API when practical.

Jobs must include:

- unique job identity;
- retries;
- exponential backoff;
- dead-letter/failure visibility;
- idempotent processing.

## Rollback

Application rollback:

- retain previous image/container version.

Database rollback:

- do not assume every migration can be reversed.
- prefer forward-compatible fixes.

## Smoke test

After deployment:

- login;
- read dashboard;
- search product;
- create non-destructive test transaction in staging;
- verify health;
- inspect error rate;
- verify queue processing.

Production smoke tests must not mutate real business data unless specifically designed for it.

## Incident basics

When something goes wrong:

1. protect data;
2. identify blast radius;
3. stop unsafe mutations if required;
4. preserve logs;
5. restore service;
6. reconcile inventory if needed;
7. document root cause;
8. add regression tests.
