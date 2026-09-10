# Development Infrastructure

This directory contains containerized infrastructure configurations for local development of the Inventory Management System using Docker Compose.

---

## 1. Purpose

Provides a reproducible, containerized local backing service stack for local development and integration testing. It orchestrates PostgreSQL 16+, Redis 7+, and MinIO with isolated persistent volumes, healthchecks, and an internal Docker network.

> [!NOTE]
> This infrastructure is strictly for **local development**. Production deployment uses managed databases, managed caches, S3-compatible cloud storage, and deployment pipelines described in `docs/deployment.md`.

---

## 2. Services

| Service        | Container Name       | Image                                      | Host Port                        | Internal Port    | Healthcheck      | Purpose                                             |
| :------------- | :------------------- | :----------------------------------------- | :------------------------------- | :--------------- | :--------------- | :-------------------------------------------------- |
| **PostgreSQL** | `inventory_postgres` | `postgres:16-alpine`                       | `5432` (or `$POSTGRES_PORT`)     | `5432`           | `pg_isready`     | Primary authoritative system of record              |
| **Redis**      | `inventory_redis`    | `redis:7-alpine`                           | `6379` (or `$REDIS_PORT`)        | `6379`           | `redis-cli ping` | Ephemeral caching, BullMQ job queues, rate limiting |
| **MinIO**      | `inventory_minio`    | `minio/minio:RELEASE.2024-03-05T04-48-44Z` | `9000` (API)<br>`9001` (Console) | `9000`<br>`9001` | `mc ready local` | Local S3-compatible object storage for file uploads |

---

## 3. Prerequisites

- **Docker Engine**: version 24.x or newer
- **Docker Compose**: version 2.x / v5.x or newer
- **Node.js**: 22.x LTS
- **pnpm**: 11.x

Verify Docker installation:

```bash
docker --version
docker compose version
```

---

## 4. Environment Setup

Copy `.env.example` to `.env` in the root workspace directory:

```bash
cp .env.example .env
```

Review and adjust variables if needed:

- `POSTGRES_PORT`: Default is `5432`. If port 5432 is already occupied by a host PostgreSQL instance, configure an alternate port (e.g. `5436` or `54320`).
- `REDIS_PORT`: Default is `6379`. If port 6379 is occupied by a host Redis instance, configure an alternate port (e.g. `6380` or `63790`).
- `MINIO_PORT`: `9000` (S3 API endpoint).
- `MINIO_CONSOLE_PORT`: `9001` (Web management console).

---

## 5. Starting Infrastructure

Start all services in detached mode in the background:

```bash
pnpm infra:up
```

_Or directly via Docker Compose:_

```bash
docker compose --env-file .env -f infra/docker-compose.yml up -d
```

---

## 6. Stopping Infrastructure

Stop and remove service containers while **preserving all persistent data**:

```bash
pnpm infra:down
```

_Or directly via Docker Compose:_

```bash
docker compose --env-file .env -f infra/docker-compose.yml down
```

---

## 7. Viewing Logs

Stream real-time log output across all infrastructure services:

```bash
pnpm infra:logs
```

Or stream logs for a specific service:

```bash
docker compose -f infra/docker-compose.yml logs -f postgres
docker compose -f infra/docker-compose.yml logs -f redis
docker compose -f infra/docker-compose.yml logs -f minio
```

---

## 8. Checking Health

Check the status and healthcheck conditions of running containers:

```bash
pnpm infra:status
```

Expected output when fully initialized:

```text
NAME                 IMAGE                      STATUS                   PORTS
inventory_minio      minio/minio:RELEASE...     Up (healthy)             0.0.0.0:9000-9001->9000-9001/tcp
inventory_postgres   postgres:16-alpine         Up (healthy)             0.0.0.0:5436->5432/tcp
inventory_redis      redis:7-alpine             Up (healthy)             0.0.0.0:6380->6379/tcp
```

Manual health verification commands:

```bash
# PostgreSQL readiness
docker exec inventory_postgres pg_isready -U postgres -d inventory_dev

# Redis responsiveness
docker exec inventory_redis redis-cli ping

# MinIO readiness
docker exec inventory_minio mc ready local
```

---

## 9. Persistence

Data is persisted across container lifecycles in named Docker volumes:

- `inventory_postgres_data` (`/var/lib/postgresql/data`)
- `inventory_redis_data` (`/data`)
- `inventory_minio_data` (`/data`)

These volumes survive container restarts and `docker compose down`.

---

## 10. Resetting Local Data

> [!CAUTION]
> The following command permanently destroys all local development database records, cached Redis data, and uploaded MinIO files:
>
> ```bash
> docker compose --env-file .env -f infra/docker-compose.yml down -v
> ```
>
> Use only when you want to return to a completely clean, uninitialized state.

---

## 11. Connecting From Host

When running development servers directly on your host machine (e.g. NestJS `apps/api` via `pnpm dev`):

### PostgreSQL

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5436/inventory_dev?schema=public
```

CLI connection:

```bash
psql -h localhost -p 5436 -U postgres -d inventory_dev
```

### Redis

```env
REDIS_URL=redis://localhost:6380
```

CLI connection:

```bash
redis-cli -p 6380 ping
```

### MinIO

```env
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=inventory-assets
```

Web Console: [http://localhost:9001](http://localhost:9001) (`minioadmin` / `minioadmin`)

---

## 12. Connecting From Docker

When running applications inside the Docker network (`inventory-network`):

All services communicate through internal Docker DNS names on their default unmapped internal ports:

### PostgreSQL

```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/inventory_dev?schema=public
```

### Redis

```env
REDIS_URL=redis://redis:6379
```

### MinIO

```env
S3_ENDPOINT=http://minio:9000
```

---

## 13. MinIO Usage

### Web Console

1. Navigate to [http://localhost:9001](http://localhost:9001) in your browser.
2. Sign in with username `minioadmin` and password `minioadmin`.
3. Browse, create, or inspect buckets and uploaded files.

### CLI Initialization / Bucket Management

Configure the MinIO client (`mc`) inside the running container:

```bash
# Configure local alias
docker exec inventory_minio mc alias set local http://localhost:9000 minioadmin minioadmin

# Create the default development bucket
docker exec inventory_minio mc mb --ignore-existing local/inventory-assets

# List buckets
docker exec inventory_minio mc ls local
```

---

## 14. Troubleshooting

### Port Conflicts on Host (EADDRINUSE)

If you see an error such as:
`Bind for 0.0.0.0:5432 failed: port is already allocated`
Your host operating system has another service listening on that port.
**Resolution**:

1. Open `.env` in the repository root.
2. Change `POSTGRES_PORT=5436` (or any available port) and `REDIS_PORT=6380`.
3. Update `DATABASE_URL` and `REDIS_URL` to reference the new host ports.
4. Run `pnpm infra:up`.

### Checking Service Logs

If a service fails health checks:

```bash
pnpm infra:logs
```

### Clean Rebuild

To completely restart without deleting persistent volumes:

```bash
pnpm infra:down
pnpm infra:up
```
